#!/usr/bin/env bash
# Daily encrypted MongoDB backup, run on the VPS by cron:
#   15 2 * * * /opt/smartaudit/backup.sh >> /var/log/smartaudit-backup.log 2>&1
#
# Reads from /opt/smartaudit/.env: MONGO_USER, MONGO_PASSWORD, BACKUP_PASSPHRASE,
# BACKUP_RCLONE_REMOTE (e.g. "eu-s3:smartaudit-backups", EU region) and BACKUP_KEEP_DAYS (default 14).
# The archive is encrypted (AES-256, PBKDF2) BEFORE leaving the server.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
set -a
# shellcheck disable=SC1091
source "$DIR/.env"
set +a

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR:-$DIR/backups}"
FILE="$OUT_DIR/smartaudit-$STAMP.archive.gz.enc"
mkdir -p "$OUT_DIR"

echo "[$STAMP] dumping"
docker compose -f "$DIR/docker-compose.yml" --env-file "$DIR/.env" exec -T mongo \
  mongodump --quiet --archive --gzip -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin --db smartaudit \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$FILE"

sha256sum "$FILE" > "$FILE.sha256"
echo "[$STAMP] local file $(du -h "$FILE" | cut -f1)"

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  rclone copy "$FILE" "$BACKUP_RCLONE_REMOTE/" && rclone copy "$FILE.sha256" "$BACKUP_RCLONE_REMOTE/"
  echo "[$STAMP] uploaded to $BACKUP_RCLONE_REMOTE"
fi

find "$OUT_DIR" -name 'smartaudit-*.enc*' -mtime "+${BACKUP_KEEP_DAYS:-14}" -delete
echo "[$STAMP] done"
