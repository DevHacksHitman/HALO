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

export HALO_RELAY_RECONCILIATION_STEP=19
export HALO_ONESHOT_LIVE=0

echo "Halo Step 19 Terminal Proof"
echo "Relay reconciliation dry-run boundary"
echo
echo "[HALO] Goal: rehearse reconciliation after the Step 18 send gate without creating a TaskId."
echo "[SECURITY] Live send is forced off for Step 19; no network send or paid claim can run here."
echo "[SECURITY] Raw context, wallet addresses, taskId, tx hash, and API keys stay local-only."

run node --test test/backend/oneShotLiveSendRehearsal.test.mjs test/backend/oneShotRelayConfirmation.test.mjs test/backend/relayReconciliation.test.mjs test/backend/grantStatus.test.mjs
run node scripts/demo_step19_relay_reconciliation.mjs

echo
echo "[HALO] Step 19 proof complete: relay reconciliation dry-run path ran."
echo "[NEXT] Step 20 is the separate live send, TaskId, status=200, /status=PAID proof."
