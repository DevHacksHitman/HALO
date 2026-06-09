#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pause() {
  if [[ "${HALO_RECORDING_FAST:-0}" != "1" ]]; then
    local seconds="${1:-1}"
    if [[ "${HALO_RECORDING_SLOW:-0}" == "1" ]]; then
      seconds=$((seconds * 2))
    fi
    sleep "$seconds"
  fi
}

if [[ -t 1 ]]; then
  clear
fi

cat <<'BANNER'
Halo Step 9 Terminal Proof
Base Sepolia deployment readiness

[HALO] Goal: prove deploy config and forge command plan before broadcasting
[CHAIN] Target is Base Sepolia, chainId 84532.
BANNER

pause 2

echo
echo "$ npm run test:backend"
npm run test:backend

pause 1

echo
echo "$ forge test -vvv"
forge test -vvv

pause 1

echo
echo "$ node scripts/demo_step9_base_sepolia_deploy_prep.mjs"
node scripts/demo_step9_base_sepolia_deploy_prep.mjs

pause 1

cat <<'BANNER'

[HALO] Step 9 proof complete. Base Sepolia deployment plan is validated
[NEXT] live RPC/private key/paymaster/enforcer addresses configure, followed by broadcast.
BANNER

pause 4
