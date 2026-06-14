import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {
  ESTIMATE_RESULT_CLASSIFICATION,
  ESTIMATE_SCENARIOS,
  ESTIMATE_PREFLIGHT_STATUS,
  buildOneShotEstimatePreflight,
  classifyOneShotEstimateResult,
  formatOneShotEstimatePreflightLogs,
  runOneShotEstimateAfterPreflight,
} from "../../lib/oneShotEstimatePreflight.mjs";
import {
  ONESHOT_RELAYER_MAINNET_RPC_URL,
  ONESHOT_RELAYER_TESTNET_RPC_URL,
} from "../../lib/oneShot.mjs";
import {BASE_MAINNET_USDC_ADDRESS} from "../../lib/chainProfiles.mjs";
import {buildErc20TransferExecution} from "../../lib/oneShotFeePlan.mjs";

const permissionContext = encodeDelegations([
  {
    delegate: "0x1111111111111111111111111111111111111111",
    delegator: "0x2222222222222222222222222222222222222222",
    authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
    caveats: [
      {
        enforcer: "0x3333333333333333333333333333333333333333",
        terms: "0x",
        args: "0x",
      },
    ],
    salt: 1n,
    signature: "0xabcd",
  },
]);
const redelegatedPermissionContext = encodeDelegations([
  {
    delegate: "0x9999999999999999999999999999999999999999",
    delegator: "0x2222222222222222222222222222222222222222",
    authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
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
    delegate: "0x1111111111111111111111111111111111111111",
    delegator: "0x9999999999999999999999999999999999999999",
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

const relayerTargetWallet = "0x1111111111111111111111111111111111111111";
const feePaymentExecution = buildErc20TransferExecution({
  token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  recipient: "0x5555555555555555555555555555555555555555",
  amount: 10_000_000,
});
const permissionGrantJson = JSON.stringify({
  context: permissionContext,
  delegationManager: "0xcccccccccccccccccccccccccccccccccccccccc",
  dependencies: [
    {
      factory: "0xdddddddddddddddddddddddddddddddddddddddd",
      factoryData: "0x1234",
    },
  ],
});
const permissionGrantWithAuthorizationJson = JSON.stringify({
  context: permissionContext,
  authorizationList: [
    {
      chainId: 8453,
      address: "0x5555555555555555555555555555555555555555",
      nonce: "0x1",
      yParity: 0,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    },
  ],
});
const dependencyTxHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("1Shot live estimate preflight", () => {
  it("blocks when real MetaMask permission context is missing", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext: "",
      permissionGrantJson: "",
      dependencyDeploymentTxs: "",
    });

    assert.equal(preflight.status, ESTIMATE_PREFLIGHT_STATUS.BLOCKED);
    assert.equal(preflight.realContextPresent, false);
    assert.ok(preflight.issues.some((issue) => issue.includes("HALO_METAMASK_PERMISSION_CONTEXT")));
  });

  it("builds a dry-run estimate request when context is present but live estimate is disabled", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext,
      liveEstimateEnabled: false,
      relayerTargetWallet: "",
      estimateScenario: ESTIMATE_SCENARIOS.FEE_AND_GRANT,
    });

    assert.equal(preflight.status, ESTIMATE_PREFLIGHT_STATUS.READY_DRY_RUN);
    assert.equal(preflight.readyForNetworkEstimate, false);
    assert.equal(preflight.estimateReport.request.method, "relayer_estimate7710Transaction");
    assert.equal(preflight.estimateReport.params.chainId, "84532");
  });

  it("blocks mainnet relayer endpoint unless explicitly allowed", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext,
      endpoint: ONESHOT_RELAYER_MAINNET_RPC_URL,
      relayerTargetWallet: "",
    });

    assert.equal(preflight.status, ESTIMATE_PREFLIGHT_STATUS.BLOCKED);
    assert.ok(preflight.issues.some((issue) => issue.includes("mainnet")));
  });

  it("uses the Base mainnet profile only when explicitly selected and a 7702 path exists", () => {
    const blocked = buildOneShotEstimatePreflight({
      permissionContext,
      chainProfile: "base-mainnet",
      liveEstimateEnabled: true,
      relayerTargetWallet,
      feePaymentExecution,
      usdcToken: BASE_MAINNET_USDC_ADDRESS,
      amount: 1_000_000,
    });

    assert.equal(blocked.status, ESTIMATE_PREFLIGHT_STATUS.BLOCKED);
    assert.equal(blocked.chainProfile, "base-mainnet");
    assert.equal(blocked.endpoint, ONESHOT_RELAYER_MAINNET_RPC_URL);
    assert.ok(blocked.issues.some((issue) => issue.includes("no deployed 7702 account code")));

    const ready = buildOneShotEstimatePreflight({
      permissionContext: "",
      permissionGrantJson: permissionGrantWithAuthorizationJson,
      chainProfile: "base-mainnet",
      liveEstimateEnabled: true,
      relayerTargetWallet,
      feePaymentExecution,
      usdcToken: BASE_MAINNET_USDC_ADDRESS,
      amount: 1_000_000,
    });

    assert.equal(ready.status, ESTIMATE_PREFLIGHT_STATUS.READY_LIVE_ESTIMATE);
    assert.equal(ready.chainId, 8453);
    assert.equal(ready.expectedEndpoint, ONESHOT_RELAYER_MAINNET_RPC_URL);
    assert.equal(ready.authorizationListPassedThrough, true);
    assert.equal(ready.estimateReport.params.authorizationList.length, 1);
    assert.equal(ready.estimateReport.params.chainId, "8453");
  });

  it("runs live estimate only after preflight passes", async () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext,
      endpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
      liveEstimateEnabled: true,
      relayerTargetWallet,
      feePaymentExecution,
    });

    const result = await runOneShotEstimateAfterPreflight(preflight, {
      fetchImpl: async (_url, init) => {
        const request = JSON.parse(init.body);
        assert.equal(request.method, "relayer_estimate7710Transaction");
        return {
          ok: true,
          json: async () => ({jsonrpc: "2.0", id: request.id, result: {gas: "0x1234"}}),
        };
      },
    });

    assert.deepEqual(result, {gas: "0x1234"});
  });

  it("can isolate a live estimate to the 1Shot fee payment execution", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext,
      endpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
      liveEstimateEnabled: true,
      relayerTargetWallet,
      feePaymentExecution,
      estimateScenario: ESTIMATE_SCENARIOS.FEE_ONLY,
    });

    assert.equal(preflight.status, ESTIMATE_PREFLIGHT_STATUS.READY_LIVE_ESTIMATE);
    assert.equal(preflight.estimateScenario, ESTIMATE_SCENARIOS.FEE_ONLY);
    assert.equal(preflight.feePaymentIncluded, true);
    assert.equal(preflight.grantExecutionIncluded, false);
    assert.equal(preflight.executionCount, 1);
  });

  it("rejects unknown estimate diagnostic scenarios", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext,
      liveEstimateEnabled: true,
      relayerTargetWallet,
      feePaymentExecution,
      estimateScenario: "unknown",
    });

    assert.equal(preflight.status, ESTIMATE_PREFLIGHT_STATUS.BLOCKED);
    assert.ok(preflight.issues.some((issue) => issue.includes("HALO_ONESHOT_ESTIMATE_SCENARIO")));
  });

  it("formats blocked preflight logs for public recordings", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext: "",
      permissionGrantJson: "",
      dependencyDeploymentTxs: "",
    });
    const logs = formatOneShotEstimatePreflightLogs(preflight);

    assert.ok(logs.some((line) => line.includes("real context present=false")));
    assert.ok(logs.some((line) => line.includes("NO-GO")));
  });

  it("blocks live estimate when the fee payment execution is missing", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext,
      endpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
      liveEstimateEnabled: true,
      relayerTargetWallet,
    });

    assert.equal(preflight.status, ESTIMATE_PREFLIGHT_STATUS.BLOCKED);
    assert.ok(preflight.issues.some((issue) => issue.includes("fee payment execution")));
  });

  it("blocks live estimate when full grant dependencies are not deployed", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext: "",
      permissionGrantJson,
      dependencyDeploymentTxs: "",
      endpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
      liveEstimateEnabled: true,
      relayerTargetWallet,
      feePaymentExecution,
    });

    assert.equal(preflight.status, ESTIMATE_PREFLIGHT_STATUS.BLOCKED);
    assert.equal(preflight.fullGrantPresent, true);
    assert.equal(preflight.realContextPresent, true);
    assert.equal(preflight.dependenciesPresent, true);
    assert.equal(preflight.dependenciesDeployed, false);
    assert.ok(preflight.issues.some((issue) => issue.includes("HALO_METAMASK_DEPENDENCY_TXS")));
  });

  it("allows live estimate after full grant dependency tx hashes are recorded", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext: "",
      permissionGrantJson,
      dependencyDeploymentTxs: JSON.stringify([dependencyTxHash]),
      endpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
      liveEstimateEnabled: true,
      relayerTargetWallet,
      feePaymentExecution,
    });

    assert.equal(preflight.status, ESTIMATE_PREFLIGHT_STATUS.READY_LIVE_ESTIMATE);
    assert.equal(preflight.dependenciesDeployed, true);
    assert.equal(preflight.dependencyDeploymentCount, 1);
  });

  it("blocks when the decoded delegation delegate is not the 1Shot relayer target wallet", () => {
    const preflight = buildOneShotEstimatePreflight({
      permissionContext,
      relayerTargetWallet: "0xf1ef956eff4181Ce913b664713515996858B9Ca9",
      liveEstimateEnabled: true,
      feePaymentExecution,
    });

    assert.equal(preflight.status, ESTIMATE_PREFLIGHT_STATUS.BLOCKED);
    assert.equal(preflight.firstDelegationDelegate, relayerTargetWallet);
    assert.equal(preflight.delegateMatchesRelayerTarget, false);
    assert.ok(preflight.issues.some((issue) => issue.includes("final delegation delegate")));
  });

  it("requires a two-hop redelegation chain before allowing A2A public claims", () => {
    const direct = buildOneShotEstimatePreflight({
      permissionContext,
      liveEstimateEnabled: true,
      relayerTargetWallet,
      feePaymentExecution,
      requireA2A: true,
    });

    assert.equal(direct.status, ESTIMATE_PREFLIGHT_STATUS.BLOCKED);
    assert.equal(direct.a2aPublicClaimAllowed, false);
    assert.ok(direct.issues.some((issue) => issue.includes("length >=2")));

    const redelegated = buildOneShotEstimatePreflight({
      permissionContext: redelegatedPermissionContext,
      liveEstimateEnabled: true,
      relayerTargetWallet,
      feePaymentExecution,
      requireA2A: true,
    });

    assert.equal(redelegated.status, ESTIMATE_PREFLIGHT_STATUS.READY_LIVE_ESTIMATE);
    assert.equal(redelegated.a2aPublicClaimAllowed, true);
    assert.equal(redelegated.finalDelegationDelegate, relayerTargetWallet);
    assert.equal(redelegated.a2aProof.delegationChainLength, 2);
  });

  it("classifies a 1Shot estimateGas revert as accepted auth plus simulation failure", () => {
    const classification = classifyOneShotEstimateResult({
      success: false,
      gasUsed: {},
      error:
        'Gas estimation failed: Function hits a revert message on the contract: missing revert data (action="estimateGas", transaction={ "data": "0xcef6d209000000" })',
    });

    assert.equal(classification.classification, ESTIMATE_RESULT_CLASSIFICATION.SIMULATION_REVERT);
    assert.equal(classification.apiKeyAcceptedByRelayer, true);
    assert.equal(classification.simulationReverted, true);
    assert.equal(classification.selectorLabel, "redeemDelegations(bytes[],bytes32[],bytes[])");
  });

  it("classifies a successful 1Shot estimate result", () => {
    const classification = classifyOneShotEstimateResult({
      success: true,
      gasUsed: {total: "0x1234"},
    });

    assert.equal(classification.classification, ESTIMATE_RESULT_CLASSIFICATION.SUCCEEDED);
    assert.equal(classification.apiKeyAcceptedByRelayer, true);
    assert.equal(classification.simulationReverted, false);
  });
});
