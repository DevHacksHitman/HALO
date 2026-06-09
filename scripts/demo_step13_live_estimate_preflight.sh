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

load_local_env

echo "Halo Step 13 Terminal Proof"
echo "1Shot live estimate preflight"
echo
echo "[HALO] Goal: check every live-estimate gate before touching the 1Shot network."
echo "[SECURITY] Live send must remain disabled."
echo "[1Shot] Network estimate runs only with real context + HALO_ONESHOT_ESTIMATE_LIVE=1."

run node --test test/backend/oneShotEstimatePreflight.test.mjs
run npm run build
run node scripts/demo_step13_live_estimate_preflight.mjs

echo
echo "[HALO] Step 13 proof complete: live-estimate preflight gates are tested."
echo "[NEXT] With a real estimate response, prepare the capped testnet send gate."
