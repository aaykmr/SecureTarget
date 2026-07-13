#!/usr/bin/env bash
# Run on the app EC2 (manually or via GitHub Actions SSH through nginx jump host).
set -euo pipefail

DEPLOY_PATH="${BACKEND_DEPLOY_PATH:-/home/ubuntu/SecureTarget}"
BRANCH="${BACKEND_DEPLOY_BRANCH:-master}"
SERVICE="${BACKEND_SYSTEMD_SERVICE:-securetarget-backend}"
HEALTH_PORT="${PORT:-8080}"
SERVICE_FILE="${DEPLOY_PATH}/backend/deploy/securetarget-backend.service"

cd "$DEPLOY_PATH"

echo "==> Fetch ${BRANCH}"
git fetch origin "$BRANCH"
git reset --hard "origin/${BRANCH}"

echo "==> Install dependencies"
npm ci

echo "==> Install systemd unit (${SERVICE})"
sudo cp "$SERVICE_FILE" "/etc/systemd/system/${SERVICE}.service"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE"

echo "==> Restart ${SERVICE}"
sudo systemctl restart "$SERVICE"

echo "==> Health check"
for attempt in 1 2 3 4 5; do
  sleep 2
  if curl -sf "http://127.0.0.1:${HEALTH_PORT}/healthz" >/dev/null; then
    curl -sf "http://127.0.0.1:${HEALTH_PORT}/healthz"
    echo ""
    echo "Deploy OK"
    exit 0
  fi
  echo "Health check attempt ${attempt}/5 failed, retrying…"
done

echo "ERROR: backend did not respond on http://127.0.0.1:${HEALTH_PORT}/healthz"
sudo systemctl status "$SERVICE" --no-pager || true
sudo journalctl -u "$SERVICE" -n 40 --no-pager || true
exit 1
