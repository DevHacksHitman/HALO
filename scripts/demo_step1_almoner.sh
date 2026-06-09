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
Halo Step 1 Terminal Proof
Foundry + HaloAlmoner redelegation caveats

[HALO] Goal: prove the local contract baseline compiles and passes.
[A2A] Master Almoner scopes Verifier and Treasurer sub-agent permissions.
[1Shot prep] Execution target is USDC; payee restrictions live in ERC20 calldata caveats.
BANNER

pause 2

echo
echo "$ $FORGE_BIN --version"
"$FORGE_BIN" --version

pause 1

echo
echo "$ $FORGE_BIN fmt --check"
"$FORGE_BIN" fmt --check

pause 1

echo
echo "$ $FORGE_BIN test --match-contract HaloAlmonerTest -vvv"
"$FORGE_BIN" test --match-contract HaloAlmonerTest -vvv

pause 1

cat <<'BANNER'

[HALO] Step 1 proof complete: Foundry scaffold + HaloAlmoner tests are green.
[NEXT] Step 2 adds Verifier/Treasurer payload builders for USDC transfers.
BANNER

pause 4
