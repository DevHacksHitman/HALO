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

echo "Halo Step 18 Terminal Proof"
echo "Fresh 1Shot estimate + live-send rehearsal gate"
echo
echo "[HALO] Goal: only send after a fresh successful estimate, exact fee match, and explicit live-send enablement."
echo "[SECURITY] Raw MetaMask context and 1Shot estimate context stay local-only."
echo "[SECURITY] HALO_ONESHOT_LIVE must be set to 1 before any network send can run."

run node --test test/backend/oneShotLiveSendRehearsal.test.mjs test/backend/oneShotEstimatePreflight.test.mjs test/backend/oneShotFeePlan.test.mjs
run node scripts/demo_step18_live_send_rehearsal.mjs

echo
echo "[HALO] Step 18 proof complete: live-send rehearsal gate ran."
echo "[NEXT] If a taskId returns, verify relayer status and signed webhook before marking grant paid."
