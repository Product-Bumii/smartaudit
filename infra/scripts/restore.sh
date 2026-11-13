#!/usr/bin/env bash
# Restores an encrypted backup produced by backup.sh:
#   ./restore.sh backups/smartaudit-20261112T021500Z.archive.gz.enc [--drop]
# WARNING: with --drop the current collections are replaced. The restore test is part of Phase 4.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
FILE="${1:?usage: restore.sh <file.enc> [--drop]}"
DROP="${2:-}"
set -a
# shellcheck disable=SC1091
source "$DIR/.env"
set +a

[ -f "$FILE.sha256" ] && sha256sum -c "$FILE.sha256"

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" \
  | docker compose -f "$DIR/docker-compose.yml" --env-file "$DIR/.env" exec -T mongo \
    mongorestore --archive --gzip -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin \
    --nsInclude 'smartaudit.*' ${DROP:+--drop}

echo "restore completed from $FILE"
