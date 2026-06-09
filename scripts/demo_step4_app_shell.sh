#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v forge >/dev/null 2>&1; then
  FORGE_BIN="forge"
elif [[ -x "$HOME/.foundry/bin/forge" ]]; then
  FORGE_BIN="$HOME/.foundry/bin/forge"
else
  echo "forge not found. Install Foundry first: https://book.getfoundry.sh/getting-started/installation"
  exit 1
fi

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
Halo Step 4 Terminal Proof
Next.js app shell + visible donor/requester demo routes

[HALO] Goal: prove the frontend shell compiles before wallet wiring.
[UI] Routes: /, /donor, /request.
[PROOF] Contract and backend baselines remain green.
BANNER

pause 2

echo
echo "$ npm run build"
npm run build

pause 1

echo
echo "$ npm run test:backend"
npm run test:backend

pause 1

echo
echo "$ $FORGE_BIN test -vvv"
"$FORGE_BIN" test -vvv

pause 1

cat <<'BANNER'

[HALO] Step 4 proof complete: app shell, backend bridge, and contracts are green.
[NEXT] Step 5 wires MetaMask Smart Accounts and Advanced Permissions.
BANNER

pause 4
