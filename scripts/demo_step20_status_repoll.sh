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

echo "Halo Step 20 Status-Only Re-Poll"
echo "TaskId -> relayer_getStatus without any resend"
echo
echo "[HALO] Goal: recover terminal status for an existing TaskId."
echo "[SECURITY] This script never estimates, sends, or resends a 1Shot transaction."
echo "[SECURITY] Raw TaskId, status payload, tx hash, and API key stay local-only."

run node --test test/backend/oneShotRelayConfirmation.test.mjs test/backend/oneShotStatusRePoll.test.mjs
run node scripts/demo_step20_status_repoll.mjs

echo
echo "[HALO] Step 20 status-only repoll complete."
echo "[NEXT] If no TaskId is available, do not create a new one unless you intentionally run a new live send."
