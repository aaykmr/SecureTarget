#!/usr/bin/env bash
# Run on the app EC2 (manually or via GitHub Actions SSH through nginx jump host).
set -euo pipefail

DEPLOY_PATH="${BACKEND_DEPLOY_PATH:-/home/ubuntu/SecureTarget}"
BRANCH="${BACKEND_DEPLOY_BRANCH:-master}"
SERVICE="${BACKEND_SYSTEMD_SERVICE:-securetarget-backend}"

cd "$DEPLOY_PATH"

echo "==> Fetch ${BRANCH}"
git fetch origin "$BRANCH"
git reset --hard "origin/${BRANCH}"

echo "==> Install dependencies"
npm ci

echo "==> Run tests"
npm test

echo "==> Restart ${SERVICE}"
sudo systemctl restart "$SERVICE"

echo "==> Health check"
sleep 2
curl -sf "http://127.0.0.1:${PORT:-8080}/healthz"
echo ""
echo "Deploy OK"
