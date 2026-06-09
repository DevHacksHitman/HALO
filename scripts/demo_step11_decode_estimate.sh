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

echo "Halo Step 11 Terminal Proof"
echo "MetaMask context decode + Base Sepolia 1Shot estimate request"
echo
echo "[HALO] Goal: decode permission context before any relayer estimate/send."
echo "[MetaMask] Using official smart-accounts-kit delegation decoder."
echo "[1Shot] Building relayer_estimate7710Transaction for Base Sepolia."
echo "Live send remains disabled."

run node --test test/backend/metaMaskPermissionDecoder.test.mjs test/backend/oneShot.test.mjs
run npm run build
run node scripts/demo_step11_decode_estimate.mjs

echo
echo "[HALO] Step 11 proof complete: decoded context feeds a Base Sepolia 1Shot estimate request."
echo "[NEXT] Capture a real wallet context, run a live estimate, then prepare a capped testnet send."
