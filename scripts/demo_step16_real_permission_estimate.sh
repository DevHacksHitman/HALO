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

echo "Halo Step 16 Terminal Proof"
echo "Real MetaMask permission context + 1Shot estimate rehearsal"
echo
echo "[HALO] Goal: verify the wallet-returned context without printing it."
echo "[MetaMask] Context must come from the donor UI permission grant."
echo "[1Shot] Estimate may run only when HALO_ONESHOT_ESTIMATE_LIVE=1."
echo "[SECURITY] HALO_ONESHOT_LIVE must remain 0."

run node --test test/backend/metaMaskPermissionDecoder.test.mjs test/backend/oneShotEstimatePreflight.test.mjs test/backend/metaMaskPermissionGrant.test.mjs
run node scripts/demo_step16_real_permission_estimate.mjs

echo
echo "[HALO] Step 16 proof complete: real-context estimate rehearsal path ran."
echo "[NEXT] If live estimate succeeds, a redacted estimate summary is stored before considering Step 18 send rehearsal."
