#!/usr/bin/env bash
# Manual deployment: infra/scripts/deploy.sh <staging|prod>
#
# 1. Builds the api, worker and web images locally (linux/amd64).
# 2. Copies them to the VPS over SSH (docker save | docker load), plus compose file and Caddyfile.
# 3. `docker compose up -d`, runs migrations and checks /api/health.
#
# Configuration (not committed): infra/.deploy.env with
#   STAGING_HOST=deploy@staging-vps.example   PROD_HOST=deploy@prod-vps.example
#   REMOTE_DIR=/opt/smartaudit                 SSH_OPTS="-p 22"
# The server keeps its own secrets in $REMOTE_DIR/.env (template: .env.example).
set -euo pipefail

ENVIRONMENT="${1:-}"
case "$ENVIRONMENT" in
  staging) DOMAIN="staging.efr.bumii.ai" ;;
  prod) DOMAIN="efr.bumii.ai" ;;
  *) echo "usage: $0 <staging|prod>" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck disable=SC1091
[ -f "$ROOT/infra/.deploy.env" ] && source "$ROOT/infra/.deploy.env"
HOST_VAR="$(echo "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')_HOST"
HOST="${!HOST_VAR:?set $HOST_VAR in infra/.deploy.env}"
REMOTE_DIR="${REMOTE_DIR:-/opt/smartaudit}"
SSH_OPTS="${SSH_OPTS:-}"
VERSION="$(git -C "$ROOT" rev-parse --short HEAD)$(git -C "$ROOT" diff --quiet || echo '-dirty')"

if [ "$ENVIRONMENT" = "prod" ] && [[ "$VERSION" == *-dirty ]]; then
  echo "refusing to deploy uncommitted changes to production" >&2
  exit 1
fi

echo "▶ Running tests"
(cd "$ROOT" && npm test)

echo "▶ Building images $VERSION"
for target in api worker web; do
  docker build --platform linux/amd64 -f "$ROOT/infra/docker/app.Dockerfile" --target "$target" \
    -t "smartaudit-$target:$VERSION" "$ROOT"
done

echo "▶ Uploading images to $HOST"
docker save "smartaudit-api:$VERSION" "smartaudit-worker:$VERSION" "smartaudit-web:$VERSION" \
  | gzip | ssh $SSH_OPTS "$HOST" "docker load"

echo "▶ Uploading compose and Caddy configuration"
ssh $SSH_OPTS "$HOST" "mkdir -p $REMOTE_DIR"
scp ${SSH_OPTS/-p/-P} "$ROOT/infra/docker-compose.yml" "$ROOT/infra/Caddyfile" "$ROOT/infra/scripts/backup.sh" \
  "$ROOT/infra/scripts/restore.sh" "$HOST:$REMOTE_DIR/"

echo "▶ Starting services"
ssh $SSH_OPTS "$HOST" "cd $REMOTE_DIR && grep -q '^DOMAIN=$DOMAIN' .env \
  && APP_VERSION=$VERSION docker compose --env-file .env up -d --remove-orphans"

echo "▶ Running migrations"
ssh $SSH_OPTS "$HOST" "cd $REMOTE_DIR && APP_VERSION=$VERSION docker compose --env-file .env exec -T api node dist/migrate.cjs"

echo "▶ Health check https://$DOMAIN/api/health"
for i in $(seq 1 30); do
  if curl -fsS "https://$DOMAIN/api/health" | grep -q '"status":"ok"'; then
    echo "✔ $ENVIRONMENT running $VERSION"
    exit 0
  fi
  sleep 5
done
echo "✘ health check failed" >&2
exit 1
