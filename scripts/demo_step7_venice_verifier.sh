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
Halo Step 7 Terminal Proof
Venice/x402 verifier agent flow

[HALO] Goal: prove receipt verification request construction and x402 top-up handling.
[VENICE] Builds multimodal chat completion payloads with wallet-auth boundary.
[SECURITY] Live Venice spend is gated until real SIWX auth + decoded MetaMask permission context exist.
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
echo "$ node scripts/demo_step7_venice_verifier.mjs"
node scripts/demo_step7_venice_verifier.mjs

pause 1

cat <<'BANNER'

[HALO] Step 7 proof complete: Venice/x402 verifier flow is tested and green.
[NEXT] Plug in real MetaMask permission context, SIWX wallet auth, and live estimates before spend.
BANNER

pause 4
