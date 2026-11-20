#!/usr/bin/env bash
# Stores (or rotates) the Gemini API key on a server as an ENCRYPTED systemd credential and restarts the API.
#   infra/scripts/set-gemini-key.sh [ssh-host]          (default: test2)
#
# - The key is typed without echo; it never appears in the command line, the shell history, .env or the repo.
# - On the server it is encrypted with systemd-creds (host key, or TPM2 if present) into
#   /etc/credstore.encrypted/gemini_api_key (root only). systemd decrypts it only for smartaudit-api
#   (ImportCredential=gemini_api_key), into a private in-memory $CREDENTIALS_DIRECTORY.
# - Also makes sure LLM_PROVIDER=gemini in /opt/smartaudit/shared/.env and that the unit imports the credential.
set -euo pipefail

HOST="${1:-test2}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

read -rsp "Gemini API key for $HOST (no se mostrará): " KEY
echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
if [ ${#KEY} -lt 20 ]; then
  echo "✘ The key looks too short; nothing changed." >&2
  exit 1
fi

# The updated unit and the remote script hold no secrets; the key travels only through ssh's stdin.
scp -q "$ROOT/infra/server/smartaudit-api.service" "$HOST:/tmp/smartaudit-api.service"
scp -q "$ROOT/infra/server/set-gemini-key-remote.sh" "$HOST:/tmp/set-gemini-key-remote.sh"
printf '%s' "$KEY" | ssh "$HOST" 'sudo bash /tmp/set-gemini-key-remote.sh /tmp/smartaudit-api.service; rc=$?; rm -f /tmp/set-gemini-key-remote.sh; exit $rc'
unset KEY
