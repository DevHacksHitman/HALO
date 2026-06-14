import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  BASE_MAINNET_CHAIN_ID,
  BASE_MAINNET_USDC_ADDRESS,
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
  HALO_CHAIN_PROFILES,
  decimalUsdcToAtoms,
  getHaloChainProfile,
  getHaloChainProfileByChainId,
  validateMainnetLiveSendReadiness,
} from "../../lib/chainProfiles.mjs";
import {
  ONESHOT_RELAYER_MAINNET_RPC_URL,
  ONESHOT_RELAYER_TESTNET_RPC_URL,
} from "../../lib/oneShot.mjs";

describe("Halo chain profiles", () => {
  it("defaults to Base Sepolia as the rehearsal lane", () => {
    const profile = getHaloChainProfile("");

    assert.equal(profile.id, HALO_CHAIN_PROFILES.BASE_SEPOLIA);
    assert.equal(profile.chainId, BASE_SEPOLIA_CHAIN_ID);
    assert.equal(profile.usdcAddress, BASE_SEPOLIA_USDC_ADDRESS);
    assert.equal(profile.relayerRpcUrl, ONESHOT_RELAYER_TESTNET_RPC_URL);
    assert.equal(profile.mainnet, false);
  });

  it("resolves Base mainnet relayer and native USDC", () => {
    const profile = getHaloChainProfile("base-mainnet");

    assert.equal(profile.id, HALO_CHAIN_PROFILES.BASE_MAINNET);
    assert.equal(profile.chainId, BASE_MAINNET_CHAIN_ID);
    assert.equal(profile.usdcAddress, BASE_MAINNET_USDC_ADDRESS);
    assert.equal(profile.relayerRpcUrl, ONESHOT_RELAYER_MAINNET_RPC_URL);
    assert.equal(getHaloChainProfileByChainId(8453).id, HALO_CHAIN_PROFILES.BASE_MAINNET);
  });

  it("keeps Base mainnet blocked until the explicit demo arming gates pass", () => {
    const profile = getHaloChainProfile("base-mainnet");
    const blocked = validateMainnetLiveSendReadiness({
      profile,
      liveSendEnabled: true,
      mainnetArmed: false,
      webhookUrlReady: true,
      estimateSucceeded: true,
      plannedGrantAmountAtoms: "1000000",
      plannedRelayerFeeAtoms: "500000",
    });

    assert.equal(blocked.ready, false);
    assert.ok(blocked.issues.some((issue) => issue.includes("HALO_MAINNET_DEMO_ARMED")));

    const ready = validateMainnetLiveSendReadiness({
      profile,
      liveSendEnabled: true,
      mainnetArmed: true,
      webhookUrlReady: true,
      estimateSucceeded: true,
      plannedGrantAmountAtoms: "1000000",
      plannedRelayerFeeAtoms: "500000",
    });

    assert.equal(ready.status, "CONDITIONAL_GO_MAINNET_ARMED");
    assert.equal(ready.ready, true);
  });

  it("blocks Base mainnet grant and relayer fees above caps", () => {
    const profile = getHaloChainProfile("base-mainnet");
    const report = validateMainnetLiveSendReadiness({
      profile,
      liveSendEnabled: true,
      mainnetArmed: true,
      webhookUrlReady: true,
      estimateSucceeded: true,
      plannedGrantAmountAtoms: "1000001",
      plannedRelayerFeeAtoms: "500001",
      maxGrantUsdc: "1",
      maxRelayerFeeUsdc: "0.50",
    });

    assert.equal(decimalUsdcToAtoms("0.50").toString(), "500000");
    assert.equal(report.ready, false);
    assert.ok(report.issues.some((issue) => issue.includes("demo grant")));
    assert.ok(report.issues.some((issue) => issue.includes("relayer fee")));
  });
});
