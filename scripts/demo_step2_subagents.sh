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
Halo Step 2 Terminal Proof
Verifier + Treasurer execution payload builders

[HALO] Goal: prove sub-agents build safe ERC20 transfer payloads.
[A2A] Verifier pays Venice/x402 invoices; Treasurer pays approved grants.
[1Shot prep] Both payloads target USDC and encode the payee inside transfer calldata.
BANNER

pause 2

echo
echo "$ $FORGE_BIN build"
"$FORGE_BIN" build

pause 1

echo
echo "$ $FORGE_BIN fmt --check"
"$FORGE_BIN" fmt --check

pause 1

echo
echo "$ $FORGE_BIN test --match-contract HaloSubAgentsTest -vvv"
"$FORGE_BIN" test --match-contract HaloSubAgentsTest -vvv

pause 1

cat <<'BANNER'

[HALO] Step 2 proof complete: sub-agent payload tests are green.
[NEXT] Step 3 wires these payloads into the backend 1Shot delegation flow.
BANNER

pause 4

