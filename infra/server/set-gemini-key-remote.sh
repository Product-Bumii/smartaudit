#!/usr/bin/env bash
# Runs ON the server as root (called by infra/scripts/set-gemini-key.sh). Reads the Gemini API key from stdin,
# stores it as an encrypted systemd credential and restarts the API. The key is never written in clear.
set -euo pipefail
UNIT_SRC="${1:-}"
ENV_FILE=/opt/smartaudit/shared/.env
CRED=/etc/credstore.encrypted/gemini_api_key

if [ -n "$UNIT_SRC" ]; then
  install -m 644 "$UNIT_SRC" /etc/systemd/system/smartaudit-api.service
  rm -f "$UNIT_SRC"
fi
install -d -m 700 /etc/credstore.encrypted
umask 077
# stdin → systemd-creds (host key / TPM2). Never an argument, never a temporary clear file.
systemd-creds encrypt --name=gemini_api_key - "$CRED"
chmod 600 "$CRED"

if grep -q '^LLM_PROVIDER=' "$ENV_FILE"; then
  sed -i 's/^LLM_PROVIDER=.*/LLM_PROVIDER=gemini/' "$ENV_FILE"
else
  echo 'LLM_PROVIDER=gemini' >> "$ENV_FILE"
fi

systemctl daemon-reload
systemctl restart smartaudit-api.service
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3100/api/health | grep -q '"status":"ok"'; then
    echo "✔ API healthy with the new Gemini key"
    exit 0
  fi
  sleep 1
done
echo "✘ API not healthy" >&2
journalctl -u smartaudit-api -n 20 --no-pager >&2
exit 1
