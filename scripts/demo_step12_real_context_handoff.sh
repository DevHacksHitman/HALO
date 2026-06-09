scripts/demo_step12_real_context_handoff.sh#!/usr/bin/env bash
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

echo "Halo Step 12 Terminal Proof"
echo "Real MetaMask context handoff"
echo
echo "[HALO] Goal: move context returned from wallet into the decoder/estimate script safely"
echo "[SECURITY] Public proof shows redacted context only."
echo "[1Shot] Live estimate/send remain explicit opt-ins."

run node --test test/backend/metaMaskPermissionHandoff.test.mjs
run npm run build
run node scripts/demo_step12_real_context_handoff.mjs

echo
echo "[HALO] Step 12 proof complete: real-context handoff path is tested and redaction-safe."
echo "[NEXT] Run a live 1Shot estimate only after a real wallet context is captured and approved."
