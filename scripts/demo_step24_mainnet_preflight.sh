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
STEP24_LIVE_SEND_INPUT_WAS_ENABLED="${HALO_ONESHOT_LIVE:-0}"

echo "Halo Step 24 Terminal Proof"
echo "Base mainnet preflight only"
echo
echo "[HALO] Goal: verify Base mainnet profile, 1Shot relayer target, caps, 7702 readiness, and A2A compatibility."
echo "[SECURITY] Step 24 forces HALO_ONESHOT_LIVE=0. It never sends a 1Shot transaction."
echo "[1Shot] Live estimate runs only when HALO_ONESHOT_ESTIMATE_LIVE=1."

run env HALO_CHAIN_PROFILE=base-sepolia HALO_ONESHOT_LIVE=0 HALO_ONESHOT_ESTIMATE_LIVE=0 node --test test/backend/oneShotEstimatePreflight.test.mjs test/backend/metaMask7702Readiness.test.mjs test/backend/a2aRedelegationProof.test.mjs test/backend/mainnetPreflight.test.mjs
run env HALO_CHAIN_PROFILE=base-mainnet HALO_ONESHOT_LIVE=0 HALO_STEP24_LIVE_SEND_INPUT_WAS_ENABLED="$STEP24_LIVE_SEND_INPUT_WAS_ENABLED" node scripts/demo_step24_mainnet_preflight.mjs

echo
echo "[HALO] Step 24 proof complete: mainnet preflight checked without send."
echo "[NEXT] Step 25 remains blocked until this preflight is clean and mainnet send is explicitly armed."
