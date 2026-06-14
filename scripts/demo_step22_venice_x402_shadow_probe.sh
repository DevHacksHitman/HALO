#!/usr/bin/env bash
set -euo pipefail

pause() {
  if [[ "${HALO_RECORDING_SLOW:-0}" == "1" ]]; then
    sleep "${HALO_RECORDING_PAUSE_SECONDS:-1}"
  fi
}

run() {
  echo
  echo "\$ $*"
  pause
  "$@"
  pause
}

load_local_env() {
  if [[ -f ".env.local" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      local key="${line%%=*}"
      local value="${line#*=}"
      [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
      if [[ -z "${!key+x}" ]]; then
        export "$key=$value"
      fi
    done < ".env.local"
  fi
}

cd "$(dirname "$0")/.."
load_local_env

echo "Halo Step 22 Terminal Proof"
echo "Venice x402 shadow probe"
echo
echo "[HALO] Goal: capture Venice's x402 payment requirement without settlement."
echo "[VENICE] Calls /x402/top-up discovery only; no X-402-Payment header is sent."
echo "[BOUNDARY] No USDC spend, A2A claim, 7702 claim, 1Shot send, or paid claim runs here."

run node --test test/backend/veniceVerifier.test.mjs
run node scripts/demo_step22_venice_x402_shadow_probe.mjs

echo
echo "[HALO] Step 22 proof complete: Venice x402 payment boundary captured in shadow mode."
echo "[NEXT] Step 23 should prove A2A redelegation chain length >=2."
