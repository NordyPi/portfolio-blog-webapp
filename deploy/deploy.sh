#!/bin/sh
# Run on the server from the ~/site folder:  ./deploy/deploy.sh
# Pulls the newest images built by GitHub Actions, runs migrations, and restarts the site.
set -eu
cd "$(dirname "$0")/.."

profiles=""
if grep -Eq '^CLOUDFLARE_TUNNEL_TOKEN=.+' .env; then profiles="--profile tunnel"; fi

docker compose $profiles pull
docker compose $profiles up -d --remove-orphans
docker image prune -f >/dev/null

docker compose ps
echo "Deployed. Logs: docker compose logs -f app"
