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
Halo Step 5 Terminal Proof
MetaMask Smart Accounts + Advanced Permissions request

[HALO] Goal: prove the donor permission payload is scoped before live redemption.
[MetaMask] Uses Smart Accounts Kit requestExecutionPermissions.
[ERC-7715] Donor signs a $100/30-day USDC permission; Halo does not custody funds.
BANNER

pause 2

echo
echo "$ npm run test:backend"
npm run test:backend

pause 1

echo
echo "$ npm run build"
npm run build

pause 1

echo
echo "$ node scripts/demo_step5_permissions.mjs"
node scripts/demo_step5_permissions.mjs

pause 1

cat <<'BANNER'

[HALO] Step 5 proof complete: Advanced Permission request is wired and tested.
[NEXT] Step 6 redeems the permission through the 1Shot delegated execution path.
BANNER

pause 4
