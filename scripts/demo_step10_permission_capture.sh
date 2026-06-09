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

echo "Halo Step 10 Terminal Proof"
echo "MetaMask permission capture boundary"
echo
echo "[HALO] Goal: inspect captured permission context without sending funds."
echo "[MetaMask] requestExecutionPermissions returns a hex context."
echo "[SECURITY] 1Shot needs decoded permission context before estimate/send."
echo "Live relay remains disabled."

run node --test test/backend/metaMaskPermissionCapture.test.mjs
run npm run build
run node scripts/demo_step10_permission_capture.mjs

echo
echo "[HALO] Step 10 proof complete: permission capture inspection is tested and green."
echo "[NEXT] Decode a real MetaMask context, then run a 1Shot estimate against Base Sepolia."
