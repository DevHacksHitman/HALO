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

echo "Halo Step 21 Terminal Proof"
echo "Venice live verifier proof"
echo
echo "[HALO] Goal: run live Venice AI against a synthetic local receipt and parse a grant decision."
echo "[VENICE] Uses Bearer credits from VENICE_API_KEY; the raw key is never printed."
echo "[BOUNDARY] No x402 settlement, A2A redelegation, 7702 readiness, 1Shot send, or paid claim runs here."

run node --test test/backend/veniceVerifier.test.mjs
run node scripts/demo_step21_venice_live_verifier.mjs

echo
echo "[HALO] Step 21 proof complete: live Venice verifier path ran."
echo "[NEXT] Step 22 should capture Venice x402 payment requirements in shadow mode."
