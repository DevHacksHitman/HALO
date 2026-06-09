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
Halo Step 3 Terminal Proof
Backend bridge for current 1Shot ERC-7710 relay drafts

[HALO] Goal: prepare relayer-safe request drafts without calling live APIs yet.
[A2A] Backend routes Verifier and Treasurer intents into scoped USDC executions.
[1Shot] Drafts /relayers OpenRPC payloads with transactions[0].permissionContext + executions.
BANNER

pause 2

echo
echo "$ node --test test/backend/haloAgentBridge.test.mjs"
node --test test/backend/haloAgentBridge.test.mjs

pause 1

echo
echo "$ npm run demo:step3"
npm run demo:step3

pause 1

cat <<'BANNER'

[HALO] Step 3 proof complete: backend bridge tests are green and 1Shot draft shape is current.
[NEXT] Step 4 starts the Next.js app shell and visible request/donor flows.
BANNER

pause 4
