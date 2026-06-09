#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

BASE_SEPOLIA_CHAIN_ID="84532"
HALO_BASE_SEPOLIA_USDC_ADDRESS="${HALO_BASE_SEPOLIA_USDC_ADDRESS:-${NEXT_PUBLIC_HALO_USDC_ADDRESS:-0x036CbD53842c5426634e7929541eC2318f3dCF7e}}"

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[ERROR] $name is required" >&2
    exit 1
  fi
}

require_address() {
  local name="$1"
  require_var "$name"
  if [[ ! "${!name}" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    echo "[ERROR] $name must be a 20-byte hex address" >&2
    exit 1
  fi
}

require_var BASE_SEPOLIA_RPC_URL
require_var BASE_SEPOLIA_PRIVATE_KEY
require_address HALO_VENICE_PAYMASTER_ADDRESS
require_address HALO_ALLOWED_TARGET_ENFORCER
require_address HALO_ERC20_TRANSFER_RECIPIENT_ENFORCER
require_address HALO_ERC20_SPEND_LIMIT_ENFORCER

if [[ ! "$BASE_SEPOLIA_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "[ERROR] BASE_SEPOLIA_PRIVATE_KEY must be a 32-byte hex private key" >&2
  exit 1
fi

if [[ ! "$HALO_BASE_SEPOLIA_USDC_ADDRESS" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "[ERROR] HALO_BASE_SEPOLIA_USDC_ADDRESS must be a 20-byte hex address" >&2
  exit 1
fi

if command -v cast >/dev/null 2>&1; then
  ACTUAL_CHAIN_ID="$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")"
  if [[ "$ACTUAL_CHAIN_ID" != "$BASE_SEPOLIA_CHAIN_ID" ]]; then
    echo "[ERROR] RPC chain id $ACTUAL_CHAIN_ID is not Base Sepolia $BASE_SEPOLIA_CHAIN_ID" >&2
    exit 1
  fi
fi

deploy_contract() {
  local contract="$1"
  local output
  output="$(forge create "$contract" --rpc-url "$BASE_SEPOLIA_RPC_URL" --private-key "$BASE_SEPOLIA_PRIVATE_KEY")"
  printf '%s\n' "$output" >&2
  local deployed
  deployed="$(printf '%s\n' "$output" | awk '/Deployed to:/ {print $3; exit}')"
  if [[ -z "$deployed" ]]; then
    echo "[ERROR] Could not parse deployed address for $contract" >&2
    exit 1
  fi
  printf '%s' "$deployed"
}

echo "[DEPLOY] Target: Base Sepolia ($BASE_SEPOLIA_CHAIN_ID)"
echo "[DEPLOY] Private key configured: yes (redacted)"

if [[ -z "${HALO_VERIFIER_AGENT_ADDRESS:-}" ]]; then
  echo "[DEPLOY] Deploying HaloVerifier helper..." >&2
  HALO_VERIFIER_AGENT_ADDRESS="$(deploy_contract src/HaloVerifier.sol:HaloVerifier)"
fi

if [[ -z "${HALO_TREASURER_AGENT_ADDRESS:-}" ]]; then
  echo "[DEPLOY] Deploying HaloTreasurer helper..." >&2
  HALO_TREASURER_AGENT_ADDRESS="$(deploy_contract src/HaloTreasurer.sol:HaloTreasurer)"
fi

echo "[DEPLOY] Deploying HaloAlmoner..." >&2
ALMONER_OUTPUT="$(
  forge create src/HaloAlmoner.sol:HaloAlmoner \
    --rpc-url "$BASE_SEPOLIA_RPC_URL" \
    --private-key "$BASE_SEPOLIA_PRIVATE_KEY" \
    --constructor-args \
    "$HALO_BASE_SEPOLIA_USDC_ADDRESS" \
    "$HALO_VENICE_PAYMASTER_ADDRESS" \
    "$HALO_VERIFIER_AGENT_ADDRESS" \
    "$HALO_TREASURER_AGENT_ADDRESS" \
    "$HALO_ALLOWED_TARGET_ENFORCER" \
    "$HALO_ERC20_TRANSFER_RECIPIENT_ENFORCER" \
    "$HALO_ERC20_SPEND_LIMIT_ENFORCER"
)"
printf '%s\n' "$ALMONER_OUTPUT" >&2
HALO_ALMONER_ADDRESS="$(printf '%s\n' "$ALMONER_OUTPUT" | awk '/Deployed to:/ {print $3; exit}')"

if [[ -z "$HALO_ALMONER_ADDRESS" ]]; then
  echo "[ERROR] Could not parse deployed HaloAlmoner address" >&2
  exit 1
fi

cat <<EOF
[DEPLOY] Base Sepolia deployment complete
HALO_VERIFIER_AGENT_ADDRESS=$HALO_VERIFIER_AGENT_ADDRESS
HALO_TREASURER_AGENT_ADDRESS=$HALO_TREASURER_AGENT_ADDRESS
HALO_ALMONER_ADDRESS=$HALO_ALMONER_ADDRESS
EOF
