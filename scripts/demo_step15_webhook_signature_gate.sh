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

echo "Halo Step 15 Terminal Proof"
echo "1Shot webhook signature gate"
echo
echo "[HALO] Goal: block forged live webhooks before they can mark grants paid."
echo "[1Shot] Signed webhook payloads use Ed25519 verification."
echo "[LOCAL] Unsigned demo payloads still work unless signature-required mode is enabled."

run node --test test/backend/oneShotWebhookSignature.test.mjs test/backend/grantStatus.test.mjs
run npm run build
run node scripts/demo_step15_webhook_signature_gate.mjs

echo
echo "[HALO] Step 15 proof complete: webhook signature gate is tested."
echo "[NEXT] Capture real MetaMask context and run the first approved live estimate only after explicit operator approval."
