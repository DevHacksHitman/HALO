import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {getSmartAccountsEnvironment} from "@metamask/smart-accounts-kit";
import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {
  STEP24_MAINNET_PREFLIGHT_STATUS,
  buildStep24MainnetPreflightPublicSummary,
  classifyStep24MainnetPreflight,
} from "../../lib/mainnetPreflight.mjs";
import {buildOneShotEstimatePreflight} from "../../lib/oneShotEstimatePreflight.mjs";
import {ONESHOT_RELAYER_MAINNET_RPC_URL} from "../../lib/oneShot.mjs";
import {BASE_MAINNET_CHAIN_ID, BASE_MAINNET_USDC_ADDRESS} from "../../lib/chainProfiles.mjs";
import {buildErc20TransferExecution} from "../../lib/oneShotFeePlan.mjs";

const relayerTarget = "0x1111111111111111111111111111111111111111";
const staleRelayerTarget = "0xf1ef956eff4181Ce913b664713515996858B9Ca9";
const masterAlmoner = "0x9999999999999999999999999999999999999999";
const donor = "0x2222222222222222222222222222222222222222";
const feeCollector = "0x5555555555555555555555555555555555555555";
const expected7702Delegator = getSmartAccountsEnvironment(BASE_MAINNET_CHAIN_ID)
  .implementations.EIP7702StatelessDeleGatorImpl;
const ready7702Code = `0xef0100${expected7702Delegator.slice(2)}`;

const redelegatedPermissionContext = encodeDelegations([
  {
    delegate: masterAlmoner,
    delegator: donor,
    authority: "0x" + "00".repeat(32),
    caveats: [
      {
        enforcer: "0x3333333333333333333333333333333333333333",
        terms: "0x01",
        args: "0x",
      },
    ],
    salt: 1n,
    signature: "0xabcd",
  },
  {
    delegate: relayerTarget,
    delegator: masterAlmoner,
    authority: "0x" + "12".repeat(32),
    caveats: [
      {
        enforcer: "0x3333333333333333333333333333333333333333",
        terms: "0x02",
        args: "0x",
      },
    ],
    salt: 2n,
    signature: "0xdcba",
  },
]);

const feePaymentExecution = buildErc20TransferExecution({
  token: BASE_MAINNET_USDC_ADDRESS,
  recipient: feeCollector,
  amount: 10_000,
});
const feePaymentPlan = {
  chainProfile: "base-mainnet",
  chainId: "8453",
  token: BASE_MAINNET_USDC_ADDRESS.toLowerCase(),
  targetAddress: relayerTarget,
  feeCollector,
  initialFeeAtoms: "10000",
  mockFeeAtoms: "10000",
};
const estimateResult = {
  success: true,
  gasUsed: {"8453": "471571"},
  requiredPaymentAmount: "10000",
  context: "signed-mainnet-estimate-context",
};

function buildReadyPreflight(options = {}) {
  return buildOneShotEstimatePreflight({
    permissionContext: redelegatedPermissionContext,
    chainProfile: "base-mainnet",
    endpoint: ONESHOT_RELAYER_MAINNET_RPC_URL,
    liveEstimateEnabled: true,
    liveSendEnabled: false,
    requireSmartAccountReadiness: true,
    requireA2A: true,
    relayerTargetWallet: relayerTarget,
    feePaymentExecution,
    feePaymentPlan,
    usdcToken: BASE_MAINNET_USDC_ADDRESS,
    amount: 1_000_000,
    accountCode: ready7702Code,
    ...options,
  });
}

describe("Step 24 mainnet preflight", () => {
  it("requires Base mainnet profile, production relayer endpoint, and Base USDC", () => {
    const preflight = buildReadyPreflight();

    assert.equal(preflight.chainProfile, "base-mainnet");
    assert.equal(preflight.chainId, 8453);
    assert.equal(preflight.endpoint, ONESHOT_RELAYER_MAINNET_RPC_URL);
    assert.equal(preflight.usdcToken, BASE_MAINNET_USDC_ADDRESS.toLowerCase());
    assert.equal(preflight.mainnetCapReport.usdcMatchesBaseMainnet, true);
  });

  it("uses the live capabilities target instead of stale env fallback", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext: redelegatedPermissionContext,
      chainProfile: "base-mainnet",
      liveEstimateEnabled: true,
      liveSendEnabled: false,
      requireSmartAccountReadiness: true,
      requireA2A: true,
      relayerTargetWallet: relayerTarget,
      feePaymentExecution,
      feePaymentPlan: {...feePaymentPlan, targetAddress: relayerTarget},
      usdcToken: BASE_MAINNET_USDC_ADDRESS,
      amount: 1_000_000,
      accountCode: ready7702Code,
      extraIssues: staleRelayerTarget ? [] : ["unreachable"],
    });

    assert.equal(preflight.expectedRelayerTargetWallet, relayerTarget);
    assert.equal(preflight.delegateMatchesRelayerTarget, true);
    assert.notEqual(preflight.expectedRelayerTargetWallet, staleRelayerTarget.toLowerCase());
  });

  it("blocks over-cap Base mainnet grants and relayer fees", () => {
    const preflight = buildReadyPreflight({
      amount: 6_000_000,
      feePaymentPlan: {...feePaymentPlan, initialFeeAtoms: "600000", mockFeeAtoms: "600000"},
    });

    assert.equal(preflight.status, "NO_GO_PREFLIGHT_BLOCKED");
    assert.equal(preflight.mainnetCapReport.grantWithinCap, false);
    assert.equal(preflight.mainnetCapReport.relayerFeeWithinCap, false);
    assert.ok(preflight.issues.some((issue) => issue.includes("demo grant")));
    assert.ok(preflight.issues.some((issue) => issue.includes("relayer fee")));
  });

  it("reports Step 24 live send input as overridden, not send-ready", () => {
    const preflight = buildReadyPreflight();
    const statusReport = classifyStep24MainnetPreflight({
      preflight,
      estimateResult,
      feePaymentPlan,
      liveSendInputWasEnabled: true,
    });
    const summary = buildStep24MainnetPreflightPublicSummary({
      preflight,
      estimateResult,
      feePaymentPlan,
      statusReport,
    });

    assert.equal(summary.status, STEP24_MAINNET_PREFLIGHT_STATUS.ESTIMATE_SUCCEEDED);
    assert.equal(summary.liveSendEnabled, false);
    assert.equal(summary.liveSendInputOverridden, true);
    assert.equal(summary.oneShotSend, false);
    assert.equal(summary.taskIdPresent, false);
  });

  it("classifies a successful estimate with changed requiredPaymentAmount as reprice required", () => {
    const report = classifyStep24MainnetPreflight({
      preflight: buildReadyPreflight(),
      estimateResult: {...estimateResult, requiredPaymentAmount: "11966"},
      feePaymentPlan,
    });

    assert.equal(report.status, STEP24_MAINNET_PREFLIGHT_STATUS.REPRICE_REQUIRED);
    assert.ok(report.issues.some((issue) => issue.includes("rebuild and re-sign")));
  });

  it("redacts raw context, signatures, and estimate context from the public summary", () => {
    const preflight = buildReadyPreflight();
    const statusReport = classifyStep24MainnetPreflight({preflight, estimateResult, feePaymentPlan});
    const summary = buildStep24MainnetPreflightPublicSummary({
      preflight,
      estimateResult,
      feePaymentPlan,
      statusReport,
    });
    const text = JSON.stringify(summary);

    assert.equal(summary.a2aProof.delegationChainLength, 2);
    assert.equal(summary.smartAccountReadiness.codeHash.startsWith("sha256:"), true);
    assert.equal(text.includes(redelegatedPermissionContext), false);
    assert.equal(text.includes("0xabcd"), false);
    assert.equal(text.includes("0xdcba"), false);
    assert.equal(text.includes(estimateResult.context), false);
  });
});
