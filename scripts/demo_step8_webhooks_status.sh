#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pause() {
  if [[ "${HALO_RECORDING_FAST:-0}" != "1" ]]; then
    local seconds="${1:-1}"
    if [[ "${HALO_RECORDING_SLOW:-0}" == "1" ]]; then
      seconds=$((seconds * 2))
    fi
    sleep "$seconds"
  fi
}

if [[ -t 1 ]]; then
  clear
fi

cat <<'BANNER'
Halo Step 8 Terminal Proof
1Shot webhook status reducer + dashboard route

[HALO] Goal: prove relayer callbacks become append-only grant status events.
[STATUS] Adds /api/webhooks/1shot, /api/grants, and /status.
[SECURITY] Live signature verification waits for provider-specific webhook signature details.
BANNER

pause 2

echo
echo "$ npm run test:backend"
npm run test:backend

pause 1

echo
echo "$ npm run build"
npm run build

pause 1

echo
echo "$ node scripts/demo_step8_webhooks_status.mjs"
node scripts/demo_step8_webhooks_status.mjs

pause 1

cat <<'BANNER'

[HALO] Step 8 proof complete: webhook status tracking is tested and green.
[NEXT] Live demo wiring: real permission context, Venice SIWX auth, 1Shot estimate/send, webhook callback.
BANNER

pause 4
