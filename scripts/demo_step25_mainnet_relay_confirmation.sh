#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "============================================================"
echo "Step 25 - Base mainnet send + status/webhook confirmation"
echo "============================================================"
echo "[SECURITY] Live send requires HALO_CHAIN_PROFILE=base-mainnet, HALO_ONESHOT_LIVE=1, and HALO_MAINNET_DEMO_ARMED=1."
echo "[SECURITY] HALO_ONESHOT_WEBHOOK_URL must be a real public HTTPS callback."
echo ""

HALO_CHAIN_PROFILE=base-mainnet node scripts/demo_step25_mainnet_relay_confirmation.mjs
