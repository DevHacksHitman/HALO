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
Halo Step 6 Terminal Proof
1Shot ERC-7710 delegated redemption wrapper

[HALO] Goal: align relay payloads with current 1Shot OpenRPC.
[1Shot] Uses /relayers JSON-RPC with transactions[0].permissionContext + executions.
[SECURITY] Live send is gated. this proves validated request construction.
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
echo "$ node scripts/demo_step6_oneshot_redeem.mjs"
node scripts/demo_step6_oneshot_redeem.mjs

pause 1

cat <<'BANNER'

[HALO] Step 6 proof complete: 1Shot 7710 request shape is tested and green.
[NEXT] Step 7 wires Venice/x402 verification into the Verifier agent.
BANNER

pause 4
