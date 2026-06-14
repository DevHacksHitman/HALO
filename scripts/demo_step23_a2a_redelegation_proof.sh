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

cd "$(dirname "$0")/.."
load_local_env

echo "Halo Step 23 Terminal Proof"
echo "A2A redelegation proof"
echo
echo "[HALO] Goal: prove ERC-7710 redelegation chain length >=2 across Verifier and Treasurer lanes."
echo "[A2A] Direct donor-to-relayer delegation is included only as a negative control."
echo "[BOUNDARY] No Venice call, x402 settlement, 1Shot send, status/webhook sync, paid claim, or mainnet claim runs here."

run node --test test/backend/a2aRedelegationProof.test.mjs
run node scripts/demo_step23_a2a_redelegation_proof.mjs

echo
echo "[HALO] Step 23 proof complete: A2A redelegation chain verified locally."
echo "[NEXT] Step 24 should run Base mainnet preflight only after 7702 readiness is aligned."
