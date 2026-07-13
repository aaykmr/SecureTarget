# SecureTarget backend — production (3× EC2)

The backend serves ingest (`/v1/record`, session bootstrap, clicks, SKAN, etc.) and the dashboard API (`/v1/auth/*`, `/v1/projects/*`). With `DATABASE_URL` set, all data lives in **Postgres**. **Redis** runs alongside Postgres for caching (wire up in backend as needed).

## Architecture

Three EC2 instances in the **same VPC**. Only the **nginx EC2** is public (Elastic IP). App and data use **private IPs only**.

```
Internet
   │
   │ HTTPS api.yourdomain.com
   ▼
┌─────────────────────────────┐
│  EC2 — Nginx (Elastic IP)     │  sg-nginx: 80, 443 from internet
│  nginx :443 → proxy           │            22 from your IP
└──────────────┬────────────────┘
               │ HTTP :8080 (private)
               ▼
┌─────────────────────────────┐
│  EC2 — App (private IP only)  │  sg-app: 8080 from sg-nginx only
│  Node backend :8080           │           22 from your IP / bastion
└──────────────┬────────────────┘
               │ 5432 / 6379 (private)
               ▼
┌─────────────────────────────┐
│  EC2 — Data (private IP only) │  sg-data: 5432, 6379 from sg-app only
│  Docker: Postgres + Redis       │
└─────────────────────────────┘

┌──────────────────┐
│  S3 + CloudFront │  React SPA (web/) — separate public URL
└──────────────────┘
```

| Host | Network | Runs |
|------|---------|------|
| **Nginx EC2** | **Elastic IP** — only public entrypoint | nginx + TLS (certbot) |
| **App EC2** | Private IP only | Node backend (`:8080`) |
| **Data EC2** | Private IP only | Docker: Postgres 16 + Redis 7 |

**DNS:** `api.yourdomain.com` A record → **nginx Elastic IP** (not app or data).

**Build URLs:** `VITE_API_URL` / `VITE_INGEST_URL` = `https://api.yourdomain.com`

**Suggested private IPs** (example /24 subnet `10.0.1.0/24`):

| Role | Example private IP |
|------|-------------------|
| Nginx | `10.0.1.10` |
| App | `10.0.1.20` |
| Data | `10.0.1.50` |

SQLite is only used when `DATABASE_URL` is unset (unit tests).

---

## Recommended setup order

1. **Data EC2** — Postgres + Redis (section 1)
2. **App EC2** — Node backend, systemd (section 2)
3. **Nginx EC2** — Elastic IP, nginx → app private IP (section 3)
4. DNS + certbot on nginx EC2
5. GitHub Actions deploys to **app EC2** only (section 5)

---

## 1. Data EC2 — Postgres + Redis (Docker)

### Instance

- Ubuntu 22.04+, same VPC as app and nginx
- **No public IP**, **no Elastic IP**
- EBS volume ≥ 20 GB recommended
- **Security group `sg-data`**

### Security group `sg-data`

| Direction | Port | Source | Purpose |
|-----------|------|--------|---------|
| Inbound | 5432 | `sg-app` | Postgres |
| Inbound | 6379 | `sg-app` | Redis |
| Inbound | 22 | `sg-nginx` or your IP | SSH (optional; for admin via jump) |
| Outbound | All | `0.0.0.0/0` | Image pulls, updates |

Never open 5432/6379 to the internet.

### Deploy

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# log out and back in

mkdir -p ~/securetarget-db && cd ~/securetarget-db
```

Copy files from the repo (clone, `scp`, or paste). Example if repo is cloned at `~/SecureTarget`:

```bash
cp ~/SecureTarget/backend/docker/docker-compose.db.yml .
cp ~/SecureTarget/backend/docker/.env.db.example .env.db
nano .env.db   # set POSTGRES_PASSWORD and REDIS_PASSWORD (openssl rand -base64 32)
```

Start (always pass `--env-file` — Compose does not auto-load `.env.db`):

```bash
docker compose -f docker-compose.db.yml --env-file .env.db up -d
docker compose -f docker-compose.db.yml --env-file .env.db ps
```

Schema is applied by the **app** backend on startup (`initPostgresSchema()`).

Note the data EC2 **private IP** (e.g. `10.0.1.50`) for app env.

### Backup (outline)

- Postgres: `docker exec securetarget-postgres pg_dump …` on a schedule
- Redis: AOF enabled in compose; optional RDB snapshots

---

## 2. App EC2 — Node backend (private only)

### Instance

- Ubuntu 22.04+, **no public IP**, **no Elastic IP**
- Place in a **private subnet** with NAT gateway (outbound internet for `npm`, `git`)
- **Security group `sg-app`**

### Security group `sg-app`

| Direction | Port | Source | Purpose |
|-----------|------|--------|---------|
| Inbound | 8080 | `sg-nginx` | API traffic from nginx EC2 |
| Inbound | 22 | `sg-nginx` | SSH from nginx jump host (GitHub deploy) |
| Outbound | 5432, 6379 | `sg-data` | Postgres + Redis |
| Outbound | 443 | `0.0.0.0/0` | npm, git (via NAT) |

Port **8080 must not** be open to `0.0.0.0/0` — only nginx reaches it.

### Env (`/etc/securetarget.env`)

```bash
# Data EC2 private IP
DATABASE_URL=postgres://securetarget:POSTGRES_PASSWORD@10.0.1.50:5432/securetarget
REDIS_URL=redis://:REDIS_PASSWORD@10.0.1.50:6379

AUTH_SECRET=long-random-secret
JWT_SECRET=long-random-secret
API_KEY_PEPPER=long-random-pepper

DASHBOARD_CORS_ORIGIN=https://app.yourdomain.com
CORS_ORIGIN=*

PORT=8080
```

Passwords must match `~/securetarget-db/.env.db` on the data host.

### Install Node backend + systemd

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

git clone git@github.com:YOUR_ORG/SecureTarget.git /home/ubuntu/SecureTarget
cd /home/ubuntu/SecureTarget
npm ci

sudo cp .env.example /etc/securetarget.env
sudo nano /etc/securetarget.env

sudo cp backend/deploy/securetarget-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now securetarget-backend
```

Verify **from the same host**:

```bash
curl -sf http://127.0.0.1:8080/healthz && echo OK
```

Verify **from nginx EC2** (after nginx host exists):

```bash
curl -sf http://10.0.1.20:8080/healthz && echo OK
```

### Deploy user (GitHub Actions via nginx jump)

GitHub Actions SSHs to the **nginx EC2** (public), then through to this **private app** host.

```bash
echo 'ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart securetarget-backend' | sudo tee /etc/sudoers.d/securetarget-deploy
```

Add the deploy SSH **public key** to `~/.ssh/authorized_keys` on the app EC2.

**Manual SSH** (same jump path as CI):

```bash
ssh -J ubuntu@<NGINX_ELASTIC_IP> ubuntu@10.0.1.20
```

See **section 5** for GitHub secrets (`BACKEND_PROXY_*` → nginx, `BACKEND_EC2_*` → app).

---

## 3. Nginx EC2 — reverse proxy + TLS (Elastic IP)

### Instance

- Ubuntu 22.04+, **public subnet**
- **Allocate and associate an Elastic IP** — this is the only address for `api.yourdomain.com`
- Small instance is enough (e.g. `t3.small`)
- **Security group `sg-nginx`**
- No Node.js or Docker required on this host

### Security group `sg-nginx`

| Direction | Port | Source | Purpose |
|-----------|------|--------|---------|
| Inbound | 443 | `0.0.0.0/0` | HTTPS |
| Inbound | 80 | `0.0.0.0/0` | HTTP redirect + certbot |
| Inbound | 22 | Your IP + GitHub Actions | SSH jump host for deploy |
| Outbound | 22 | `sg-app` | ProxyJump SSH to app EC2 |
| Outbound | 8080 | `sg-app` | Proxy to backend |
| Outbound | 443 | `0.0.0.0/0` | certbot |

### Step 1 — Elastic IP and DNS

1. EC2 → **Elastic IPs** → Allocate → **Associate** with nginx instance
2. Route 53 (or your DNS): **A record** `api.yourdomain.com` → Elastic IP
3. Wait for DNS propagation (`dig api.yourdomain.com`)

### Step 2 — Install nginx and certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

### Step 3 — Deploy site config

Copy config from the repo (on your laptop, `scp` to nginx EC2, or clone repo on nginx host):

```bash
# On nginx EC2 — example if you scp'd the file to ~/
sudo cp ~/securetarget-api.conf /etc/nginx/sites-available/securetarget-api
```

Or from a cloned repo:

```bash
sudo cp ~/SecureTarget/backend/deploy/nginx/securetarget-api.conf \
  /etc/nginx/sites-available/securetarget-api
```

**Edit two things** before enabling:

```bash
sudo nano /etc/nginx/sites-available/securetarget-api
```

1. **`server_name`** — replace `api.example.com` with `api.yourdomain.com` (both server blocks)
2. **`upstream securetarget_backend`** — replace `10.0.1.20` with your **app EC2 private IP**

Enable the site:

```bash
sudo ln -sf /etc/nginx/sites-available/securetarget-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### Step 4 — HTTP first (for certbot)

If SSL certificate paths do not exist yet, temporarily use HTTP-only:

- Comment out the entire `server { listen 443 … }` block, **or**
- Run certbot in standalone mode before enabling full config

Test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Confirm app is reachable through nginx **before** TLS (temporarily proxy on port 80 only if needed):

```bash
curl -sf http://10.0.1.20:8080/healthz   # direct to app (from nginx host)
```

### Step 5 — TLS with Let's Encrypt

Ensure DNS points to this Elastic IP, then:

```bash
sudo certbot --nginx -d api.yourdomain.com
sudo certbot renew --dry-run
```

Certbot updates the config with certificate paths. Re-check upstream IP if certbot rewrote the file.

### Step 6 — Verify end-to-end

```bash
curl -sf https://api.yourdomain.com/healthz && echo OK
```

From your laptop:

```bash
curl -sf https://api.yourdomain.com/healthz
```

### What nginx does

- Terminates TLS on `:443` (public Elastic IP)
- Proxies all paths to `http://<app-private-ip>:8080`
- Covers ingest, dashboard API, `/healthz`, tracking links `/v1/l/…`
- Sets `X-Forwarded-For` and `X-Forwarded-Proto` for the backend

Reference config: [`backend/deploy/nginx/securetarget-api.conf`](deploy/nginx/securetarget-api.conf)

### Optional — harden nginx EC2

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Nginx EC2 as SSH jump host (deploy only)

Nginx also acts as a **bastion** so GitHub Actions can reach the private app EC2:

1. Add the same deploy SSH public key to `~/.ssh/authorized_keys` on **nginx** and **app**
2. Ensure `AllowTcpForwarding yes` in `/etc/ssh/sshd_config` on nginx (Ubuntu default)
3. Open **sg-nginx** inbound 22 for GitHub (key-only auth; restrict to your IP + [GitHub Actions IP ranges](https://api.github.com/meta) if desired)

GitHub Actions **does not** deploy nginx config — only certbot renewal and manual nginx edits happen here.

---

## 4. Dashboard API routes

| Method | Path |
|--------|------|
| POST | `/v1/auth/register` |
| POST | `/v1/auth/login` |
| GET | `/v1/auth/me` |
| GET/POST | `/v1/projects` |
| GET | `/v1/projects/:id` |
| GET/POST | `/v1/projects/:id/api-keys` |
| DELETE | `/v1/projects/:id/api-keys/:keyId` |

Set `DASHBOARD_CORS_ORIGIN` to your CloudFront SPA origin.

---

## 5. GitHub Actions deploy (app EC2 via nginx jump)

Workflow: [`.github/workflows/deploy-backend.yml`](../../.github/workflows/deploy-backend.yml)

| Job | Where it runs | What it does |
|-----|---------------|--------------|
| `test` | GitHub-hosted (`ubuntu-latest`) | `npm ci` + `npm test` |
| `deploy` | GitHub-hosted → SSH via **nginx jump** → **app EC2** | `git pull`, `npm ci`, `npm test`, `systemctl restart` |

Because the app EC2 has **no public IP**, the workflow uses `appleboy/ssh-action` with a **ProxyJump** through the nginx EC2 (Elastic IP).

```
GitHub Actions runner
    │ SSH :22
    ▼
Nginx EC2 (BACKEND_PROXY_HOST — Elastic IP)
    │ SSH :22 → app private IP
    ▼
App EC2 (BACKEND_EC2_HOST — e.g. 10.0.1.20)
    └── deploy-backend-remote.sh
```

### One-time bootstrap

1. Clone repo on app EC2, enable systemd (section 2)
2. Add deploy key to `authorized_keys` on **app** and **nginx**
3. Verify jump from your laptop: `ssh -J ubuntu@<NGINX_EIP> ubuntu@10.0.1.20`
4. Add GitHub secrets below

### Repository secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `BACKEND_EC2_HOST` | Yes | App EC2 **private IP** (e.g. `10.0.1.20`) |
| `BACKEND_EC2_USER` | Yes | `ubuntu` |
| `BACKEND_EC2_SSH_KEY` | Yes | Private key authorized on **app** EC2 |
| `BACKEND_EC2_SSH_PORT` | No | App SSH port; default `22` |
| `BACKEND_PROXY_HOST` | Yes | Nginx **Elastic IP** (jump host) |
| `BACKEND_PROXY_USER` | Yes | `ubuntu` on nginx |
| `BACKEND_PROXY_KEY` | Yes | Private key authorized on **nginx** EC2 (can match `BACKEND_EC2_SSH_KEY`) |
| `BACKEND_PROXY_PORT` | No | Nginx SSH port; default `22` |

### Repository variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_DEPLOY_PATH` | `/home/ubuntu/SecureTarget` | Repo path on app EC2 |
| `BACKEND_DEPLOY_BRANCH` | `master` | Branch to deploy |
| `BACKEND_SYSTEMD_SERVICE` | `securetarget-backend` | systemd unit |

### Secrets on app EC2 only (`/etc/securetarget.env`)

- `DATABASE_URL`, `REDIS_URL` → data private IP
- `AUTH_SECRET`, `JWT_SECRET`, `API_KEY_PEPPER`
- `DASHBOARD_CORS_ORIGIN`, `CORS_ORIGIN`

---

## 6. Local dev (Docker Postgres + Redis)

```bash
cp .env.example .env
cp web/.env.example web/.env
npm run db:up
npm run dev:backend
npm run dev:web
```

- `DATABASE_URL=postgres://securetarget:securetarget@localhost:5433/securetarget`
- `REDIS_URL=redis://localhost:6380`

---

## 7. Web deploy secrets (SPA — separate workflow)

| Secret | Used for |
|--------|----------|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Same IAM creds as site deploy (S3 `prod-eventiqn`, CloudFront `E1NEODDOVZAKG0`) |

`VITE_*` URLs are set in `deploy-web.yml` for `eventiqn.trusttargets.com`.
