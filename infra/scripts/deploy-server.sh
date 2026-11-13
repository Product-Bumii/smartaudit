#!/usr/bin/env bash
# Deploys a new release to a host WITHOUT Docker (systemd + nginx), provisioned with provision-server.sh.
#   infra/scripts/deploy-server.sh [ssh-host]        (default: test2)
#
# Builds API/worker bundles and the Angular app locally, uploads them, switches the `current` symlink,
# runs migrations (and the synthetic seed on the first deploy), restarts the services and checks health.
set -euo pipefail

HOST="${1:-test2}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="$(date -u +%Y%m%d%H%M%S)-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "▶ Building $VERSION"
(cd "$ROOT" && npm run build -w apps/api >/dev/null && npm run build -w apps/worker >/dev/null && npm run build -w apps/web >/dev/null)
mkdir -p "$STAGE/release/api" "$STAGE/release/worker" "$STAGE/release/web"
cp "$ROOT"/apps/api/dist/*.cjs "$ROOT"/apps/api/dist/*.cjs.map "$STAGE/release/api/"
cp "$ROOT"/apps/worker/dist/*.cjs "$ROOT"/apps/worker/dist/*.cjs.map "$STAGE/release/worker/"
cp -R "$ROOT"/apps/web/dist/web/browser/. "$STAGE/release/web/"
echo "$VERSION" > "$STAGE/release/VERSION"
tar -czf "$STAGE/release.tgz" -C "$STAGE/release" .

echo "▶ Uploading to $HOST"
scp -q "$STAGE/release.tgz" "$HOST:/tmp/smartaudit-$VERSION.tgz"

echo "▶ Activating release"
ssh "$HOST" "sudo VERSION=$VERSION bash -s" <<'REMOTE'
set -euo pipefail
APP=/opt/smartaudit
REL=$APP/releases/$VERSION
mkdir -p "$REL"
tar -xzf "/tmp/smartaudit-$VERSION.tgz" -C "$REL"
rm -f "/tmp/smartaudit-$VERSION.tgz"
chown -R root:root "$REL"
find "$REL" -type d -exec chmod 755 {} +
find "$REL" -type f -exec chmod 644 {} +

run_as_app() { sudo -u smartaudit bash -c "set -a; . $APP/shared/.env; set +a; cd $REL/api; $1"; }
run_as_app "node migrate.cjs"
if [ ! -f $APP/shared/.seeded ]; then
  run_as_app "node seed.cjs" && touch $APP/shared/.seeded
fi

ln -sfn "$REL" $APP/current
systemctl restart smartaudit-api.service smartaudit-worker.service
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3100/api/health | grep -q '"status":"ok"'; then
    echo "✔ API healthy ($VERSION)"
    break
  fi
  [ "$i" = 30 ] && { echo "✘ API not healthy" >&2; journalctl -u smartaudit-api -n 40 --no-pager >&2; exit 1; }
  sleep 1
done
systemctl is-active --quiet smartaudit-worker.service && echo "✔ worker running" || { echo "✘ worker not running" >&2; exit 1; }

# Keep the last 5 releases.
ls -1dt $APP/releases/* | tail -n +6 | xargs -r rm -rf
REMOTE
echo "✔ Deployed $VERSION to $HOST"
