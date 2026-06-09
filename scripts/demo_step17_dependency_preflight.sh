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

echo "Halo Step 17 Terminal Proof"
echo "MetaMask dependency preflight for redeemDelegations"
echo
echo "[HALO] Goal: inspect the wallet grant without printing raw context or factoryData."
echo "[MetaMask] Dependencies must be deployed through the donor UI if present."
echo "[SECURITY] This script never deploys dependencies and never sends 1Shot transactions."

run node --test test/backend/metaMaskPermissionCapture.test.mjs test/backend/metaMaskPermissionHandoff.test.mjs test/backend/metaMaskPermissionGrant.test.mjs
run node scripts/demo_step17_dependency_preflight.mjs

echo
echo "[HALO] Step 17 proof complete: dependency preflight is recorded."
echo "[NEXT] Deploy dependencies through /donor if present, then rerun Step 16 estimate."
