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

echo "Halo Step 14 Terminal Proof"
echo "Capped 1Shot testnet send gate"
echo
echo "[HALO] Goal: require context + estimate + cap check before any 1Shot send."
echo "[TREASURER] Grant payout cap remains 30 USDC."
echo "[SECURITY] Network send runs only with HALO_ONESHOT_LIVE=1."

run node --test test/backend/oneShotSendGate.test.mjs
run npm run build
run node scripts/demo_step14_capped_send_gate.mjs

echo
echo "[HALO] Step 14 proof complete: capped send gate is tested."
echo "[NEXT] Confirm taskId/status through webhook tracking after any approved live testnet send."
