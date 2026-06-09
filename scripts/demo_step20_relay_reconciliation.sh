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

echo "Halo Step 20 Terminal Proof"
echo "Relay reconciliation + final confirmation boundary"
echo
echo "[HALO] Goal: reconcile the live send path without overclaiming payout."
echo "[1Shot] A TaskId or signed webhook/status confirmation is required before paid claims."
echo "[SECURITY] Raw context, wallet addresses, taskId, tx hash, and API keys stay local-only."

run node --test test/backend/oneShotLiveSendRehearsal.test.mjs test/backend/oneShotRelayConfirmation.test.mjs test/backend/relayReconciliation.test.mjs test/backend/grantStatus.test.mjs
run node scripts/demo_step20_relay_reconciliation.mjs

echo
echo "[HALO] Step 20 proof complete: relay reconciliation path ran."
echo "[NEXT] If TaskId/status is still missing, treat Step 19/20 as a debug note, not a paid proof."
