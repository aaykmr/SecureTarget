# SecureTarget backend — production (split EC2)

The backend serves ingest (`/v1/record`, session bootstrap, clicks, SKAN, etc.) and the dashboard API (`/v1/auth/*`, `/v1/projects/*`). With `DATABASE_URL` set, all data lives in **Postgres**. **Redis** is deployed alongside Postgres for caching (session/rate-limit/event dedup — wire up in backend as needed).

## Architecture

```
Internet
   │
   │ HTTPS (api.yourdomain.com)
   ▼
┌──────────────────────────────────────┐
│  EC2 — App (Elastic IP)              │
│  nginx :443  ──►  Node backend :8080 │
│  (public)         (127.0.0.1 only)   │
└──────────────┬───────────────────────┘
               │ private VPC (10.0.x.x)
               ├──5432──► Postgres (Docker) on Data EC2
               └──6379──► Redis (Docker) on Data EC2

┌──────────────────┐
│  S3 + CloudFront │  React SPA (web/) — separate public URL
└──────────────────┘
```

| Host | Network | Runs |
|------|---------|------|
| **App EC2** | **Elastic IP** (public HTTPS + SSH) | nginx, Node backend on `127.0.0.1:8080` |
| **Data EC2** | **Private IP only** (no public IP) | Docker: Postgres 16 + Redis 7 |

Point `api.yourdomain.com` DNS **A record** at the app EC2 **Elastic IP**. The SPA (`VITE_API_URL`) and SDK ingest URL should use `https://api.yourdomain.com`.

SQLite is only used when `DATABASE_URL` is unset (unit tests).

---

## 1. Data EC2 — Postgres + Redis (Docker)

### Instance

- Ubuntu 22.04+, install Docker Engine + Compose plugin
- EBS volume for Docker data (recommended ≥ 20 GB)
- **Security group**: allow inbound **5432** and **6379** only from the **app EC2 security group** (no public access)

### Deploy

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# log out/in, then:

mkdir -p ~/securetarget-db && cd ~/securetarget-db
# Copy backend/docker/docker-compose.db.yml and .env.db.example from the repo
cp /path/to/repo/backend/docker/docker-compose.db.yml .
cp /path/to/repo/backend/docker/.env.db.example .env.db
# Edit .env.db — set strong POSTGRES_PASSWORD and REDIS_PASSWORD

docker compose -f docker-compose.db.yml --env-file .env.db up -d
docker compose -f docker-compose.db.yml ps
```

Schema is **not** applied on the data host — the app backend runs `initPostgresSchema()` on startup.

Note the data EC2 **private IP** (e.g. `10.0.1.50`) for the app server env.

### Backup (outline)

- Postgres: nightly `pg_dump` from app EC2 or a cron job on data EC2 via `docker exec securetarget-postgres pg_dump …`
- Redis: AOF is enabled (`appendonly yes`); snapshot RDB if you add a backup cron

---

## 2. App EC2 — nginx + backend API

### VPC & Elastic IP

1. Launch app EC2 in the **same VPC** as the data EC2 (same region).
2. **Allocate an Elastic IP** (EC2 → Elastic IPs → Allocate → Associate with app instance).
3. Use the Elastic IP for:
   - DNS `api.yourdomain.com` A record
   - GitHub Actions `BACKEND_EC2_HOST` (or the domain name)
   - SSH deploy access
4. Data EC2: **no Elastic IP**, **no public IP** — only a private IP (e.g. `10.0.1.50`).

### Security groups

**App EC2 (`sg-app`)**

| Direction | Port | Source | Purpose |
|-----------|------|--------|---------|
| Inbound | 443 | `0.0.0.0/0` | HTTPS (nginx) |
| Inbound | 80 | `0.0.0.0/0` | HTTP → HTTPS redirect + certbot |
| Inbound | 22 | Your IP or bastion | SSH / GitHub deploy |
| Outbound | 5432, 6379 | `sg-data` | Postgres + Redis on data EC2 |
| Outbound | 443 | `0.0.0.0/0` | apt, npm, certbot |

**Data EC2 (`sg-data`)**

| Direction | Port | Source | Purpose |
|-----------|------|--------|---------|
| Inbound | 5432 | `sg-app` | Postgres |
| Inbound | 6379 | `sg-app` | Redis |
| Outbound | (default) | — | Updates only |

Do **not** open 5432/6379 to the internet.

### Env (`/etc/securetarget.env`)

```bash
# Data EC2 private IP (not Elastic IP)
DATABASE_URL=postgres://securetarget:POSTGRES_PASSWORD@10.0.1.50:5432/securetarget
REDIS_URL=redis://:REDIS_PASSWORD@10.0.1.50:6379

AUTH_SECRET=long-random-secret
JWT_SECRET=long-random-secret
API_KEY_PEPPER=long-random-pepper

DASHBOARD_CORS_ORIGIN=https://app.yourdomain.com
CORS_ORIGIN=*

PORT=8080
```

Use the same `POSTGRES_PASSWORD` / `REDIS_PASSWORD` as in the data host `.env.db`.

Set SPA build secrets to the public API URL: `VITE_API_URL=https://api.yourdomain.com`, `VITE_INGEST_URL=https://api.yourdomain.com`.

### Install Node backend + systemd

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

git clone git@github.com:YOUR_ORG/SecureTarget.git /home/ubuntu/SecureTarget
cd /home/ubuntu/SecureTarget
npm ci

sudo cp .env.example /etc/securetarget.env
sudo nano /etc/securetarget.env   # fill DATABASE_URL (private IP), secrets, CORS

sudo cp backend/deploy/securetarget-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now securetarget-backend
curl -sf http://127.0.0.1:8080/healthz && echo OK
```

The backend listens on **all interfaces** at `:8080` by default; nginx is the only public entrypoint. Optionally restrict with a firewall (`ufw allow 22,80,443` only).

### nginx — reverse proxy + TLS

Install nginx and certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

Copy and edit the site config (replace `api.example.com`):

```bash
sudo cp /home/ubuntu/SecureTarget/backend/deploy/nginx/securetarget-api.conf \
  /etc/nginx/sites-available/securetarget-api
sudo nano /etc/nginx/sites-available/securetarget-api   # set server_name

sudo ln -sf /etc/nginx/sites-available/securetarget-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

**Before TLS:** use a temporary HTTP-only server block if cert paths do not exist yet, or comment out the `ssl_*` lines and use only port 80 for the first `nginx -t`.

Point DNS: `api.yourdomain.com` → **Elastic IP**, wait for propagation, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com
sudo certbot renew --dry-run
```

Verify:

```bash
curl -sf https://api.yourdomain.com/healthz && echo OK
```

Reference config: [`backend/deploy/nginx/securetarget-api.conf`](deploy/nginx/securetarget-api.conf)

**What nginx does**

- Terminates TLS on `:443` (public)
- Proxies all paths to `http://127.0.0.1:8080` (ingest, dashboard API, `/healthz`, tracking links `/v1/l/…`)
- Sets `X-Forwarded-For` / `X-Forwarded-Proto` for correct client IP and HTTPS detection

**Port 8080** is not exposed in the app security group — only nginx needs to be public.

---

## Dashboard API routes

| Method | Path |
|--------|------|
| POST | `/v1/auth/register` |
| POST | `/v1/auth/login` |
| GET | `/v1/auth/me` |
| GET/POST | `/v1/projects` |
| GET | `/v1/projects/:id` |
| GET/POST | `/v1/projects/:id/api-keys` |
| DELETE | `/v1/projects/:id/api-keys/:keyId` |

Set `DASHBOARD_CORS_ORIGIN` to your CloudFront SPA origin. The dashboard sends `Authorization: Bearer <jwt>`.

---

## Local dev (Docker Postgres + Redis)

From the monorepo root:

```bash
cp .env.example .env
cp web/.env.example web/.env
npm run db:up          # Postgres :5433, Redis :6380
npm run dev:backend
npm run dev:web
```

Local URLs (see `.env.example`):

- `DATABASE_URL=postgres://securetarget:securetarget@localhost:5433/securetarget`
- `REDIS_URL=redis://localhost:6380` (no password locally)

Port **5433** / **6380** avoid conflicts with native Postgres/Redis on default ports.

Without `DATABASE_URL`, the backend falls back to SQLite for unit tests only.

---

## GitHub Actions deploy (app EC2)

Workflow: [`.github/workflows/deploy-backend.yml`](../../.github/workflows/deploy-backend.yml)

On push to `master` (backend / packages paths), CI runs tests then SSHs to the **app EC2**, runs `scripts/deploy-backend-remote.sh` (git pull, `npm ci`, `npm test`, `systemctl restart`), and hits `/healthz`.

The **data EC2** (Postgres + Redis Docker) is **not** deployed by this workflow — set it up once manually (section 1).

### One-time app EC2 bootstrap (summary)

Order of operations:

1. Launch app EC2 in VPC, attach **Elastic IP**, apply **sg-app**
2. Install Node 20, clone repo, create `/etc/securetarget.env` (data EC2 **private** IP for `DATABASE_URL` / `REDIS_URL`)
3. Enable `securetarget-backend` systemd unit — verify `curl http://127.0.0.1:8080/healthz`
4. Install **nginx** + **certbot**, deploy site config, DNS A record → Elastic IP, run `certbot --nginx`
5. Allow deploy SSH + passwordless systemd restart:

```bash
echo 'ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart securetarget-backend' | sudo tee /etc/sudoers.d/securetarget-deploy
```

Add the GitHub Actions deploy SSH public key to `~/.ssh/authorized_keys`.

See **section 2** for full nginx, security group, and env details.

### Repository secrets (Settings → Secrets and variables → Actions → Secrets)

| Secret | Required | Description |
|--------|----------|-------------|
| `BACKEND_EC2_HOST` | Yes | App EC2 **Elastic IP** or `api.yourdomain.com` (same host nginx serves) |
| `BACKEND_EC2_USER` | Yes | SSH user (e.g. `ubuntu`) |
| `BACKEND_EC2_SSH_KEY` | Yes | Private key for deploy (PEM). Matching public key on the instance. |
| `BACKEND_EC2_SSH_PORT` | No | SSH port; default `22` if omitted |

### Repository variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_DEPLOY_PATH` | `/home/ubuntu/SecureTarget` | Git clone path on app EC2 |
| `BACKEND_DEPLOY_BRANCH` | `master` | Branch to deploy |
| `BACKEND_SYSTEMD_SERVICE` | `securetarget-backend` | systemd unit name |

### What stays on the server (not in GitHub)

Keep in `/etc/securetarget.env` on the app EC2 only:

- `DATABASE_URL` — points to **data EC2** private IP
- `REDIS_URL` — points to **data EC2** private IP
- `AUTH_SECRET`, `JWT_SECRET`, `API_KEY_PEPPER`
- `DASHBOARD_CORS_ORIGIN`, `CORS_ORIGIN`

Do **not** add database passwords or JWT secrets to GitHub Actions secrets unless you automate env file generation (not recommended).

### Web deploy secrets (SPA — separate workflow)

These are used by `deploy-web.yml`, not the backend workflow:

| Secret | Used for |
|--------|----------|
| `WEB_S3_BUCKET`, `WEB_CLOUDFRONT_DOMAIN`, `WEB_CLOUDFRONT_DISTRIBUTION_ID` | S3 + CloudFront |
| `VITE_API_URL`, `VITE_INGEST_URL`, `VITE_APP_URL` | Build-time SPA URLs (`VITE_*` should be `https://api.yourdomain.com` and CloudFront app URL) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Shared AWS creds (web + optional tooling) |

