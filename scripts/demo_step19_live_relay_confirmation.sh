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

echo "Halo Step 19 Terminal Proof"
echo "1Shot live relay send + status confirmation gate"
echo
echo "[HALO] Goal: submit only after Step 18 gates, then verify relayer status before paid claim."
echo "[SECURITY] Raw MetaMask context, estimate context, taskId, and tx hash stay local-only."
echo "[SECURITY] HALO_ONESHOT_LIVE=1 is required before any network send can run."

run node --test test/backend/oneShotLiveSendRehearsal.test.mjs test/backend/oneShotRelayConfirmation.test.mjs test/backend/grantStatus.test.mjs
run node scripts/demo_step19_live_relay_confirmation.mjs

echo
echo "[HALO] Step 19 proof complete: relay confirmation path ran."
echo "[NEXT] If status is not paid yet, rerun status polling or wait for signed webhook."
