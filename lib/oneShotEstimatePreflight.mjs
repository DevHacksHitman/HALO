import {buildUsdcTransferExecution} from "./haloAgentBridge.mjs";
import {
  BASE_SEPOLIA_CHAIN_ID,
  buildBaseSepoliaEstimateRequestFromPermissionContext,
} from "./metaMaskPermissionDecoder.mjs";
import {
  ONESHOT_RELAYER_MAINNET_RPC_URL,
  ONESHOT_RELAYER_RPC_URL,
  ONESHOT_RELAYER_TESTNET_RPC_URL,
  estimateOneShot7710Transaction,
} from "./oneShot.mjs";
import {normalizeAddress} from "./hex.mjs";
import {
  DEPENDENCY_PLAN_STATUS,
  buildDependencyDeploymentPlan,
  parsePermissionGrantJson,
  summarizePermissionGrantShape,
} from "./metaMaskPermissionGrant.mjs";

export const LIVE_ESTIMATE_ENV_VAR = "HALO_ONESHOT_ESTIMATE_LIVE";
export const LIVE_SEND_ENV_VAR = "HALO_ONESHOT_LIVE";
export const METAMASK_CONTEXT_ENV_VAR = "HALO_METAMASK_PERMISSION_CONTEXT";
export const METAMASK_GRANT_ENV_VAR = "HALO_METAMASK_PERMISSION_GRANT_JSON";
export const RELAYER_TARGET_WALLET_ENV_VAR = "ONESHOT_RELAYER_TARGET_WALLET_ADDRESS";
export const ESTIMATE_SCENARIO_ENV_VAR = "HALO_ONESHOT_ESTIMATE_SCENARIO";

export const ESTIMATE_SCENARIOS = Object.freeze({
  FEE_AND_GRANT: "fee_and_grant",
  FEE_ONLY: "fee_only",
});

export const ESTIMATE_PREFLIGHT_STATUS = Object.freeze({
  BLOCKED: "NO_GO_PREFLIGHT_BLOCKED",
  READY_DRY_RUN: "CONDITIONAL_GO_READY_DRY_RUN",
  READY_LIVE_ESTIMATE: "CONDITIONAL_GO_LIVE_ESTIMATE_READY",
});

export const ESTIMATE_RESULT_CLASSIFICATION = Object.freeze({
  SUCCEEDED: "CONDITIONAL_GO_ESTIMATE_SUCCEEDED",
  SIMULATION_REVERT: "NO_GO_SIMULATION_REVERT",
  FAILED: "NO_GO_ESTIMATE_FAILED",
  UNKNOWN: "CHECK_UNKNOWN_ESTIMATE_RESULT",
});

export const REDEEM_DELEGATIONS_SELECTOR = "0xcef6d209";

export function buildOneShotEstimatePreflight({
  permissionContext = process.env.HALO_METAMASK_PERMISSION_CONTEXT,
  permissionGrantJson = process.env.HALO_METAMASK_PERMISSION_GRANT_JSON,
  dependencyDeploymentTxs = process.env.HALO_METAMASK_DEPENDENCY_TXS,
  endpoint = ONESHOT_RELAYER_RPC_URL,
  liveEstimateEnabled = process.env.HALO_ONESHOT_ESTIMATE_LIVE === "1",
  liveSendEnabled = process.env.HALO_ONESHOT_LIVE === "1",
  allowMainnetEndpoint = process.env.HALO_ALLOW_MAINNET_RELAYER_ESTIMATE === "1",
  relayerTargetWallet = process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS,
  feePaymentExecution = null,
  feePaymentPlan = null,
  estimateScenario = process.env.HALO_ONESHOT_ESTIMATE_SCENARIO || ESTIMATE_SCENARIOS.FEE_AND_GRANT,
  extraIssues = [],
  usdcToken = process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  recipient = "0x4444444444444444444444444444444444444444",
  amount = 25_000_000,
  destinationUrl = "https://example.com/api/webhooks/1shot",
  memo = "Halo Step 13 live estimate preflight",
  requestId = 13,
} = {}) {
  const issues = [...extraIssues];
  let estimateReport = null;
  let expectedRelayerTargetWallet = "";
  let firstDelegationDelegate = "";
  let grantExecutionIncluded = false;
  let permissionGrant = null;
  let grantShape = null;
  let dependencyPlan = buildDependencyDeploymentPlan({dependencies: [], deploymentTxs: []});

  try {
    permissionGrant = parsePermissionGrantJson(permissionGrantJson);
    if (permissionGrant) {
      grantShape = summarizePermissionGrantShape(permissionGrant);
      dependencyPlan = buildDependencyDeploymentPlan({
        grant: permissionGrant,
        deploymentTxs: dependencyDeploymentTxs,
      });
    }
  } catch (error) {
    issues.push(error.message);
  }

  const effectivePermissionContext = permissionContext || permissionGrant?.context || "";

  if (!Object.values(ESTIMATE_SCENARIOS).includes(estimateScenario)) {
    issues.push(`${ESTIMATE_SCENARIO_ENV_VAR} must be one of: ${Object.values(ESTIMATE_SCENARIOS).join(", ")}`);
  }

  if (!effectivePermissionContext) {
    issues.push(`${METAMASK_CONTEXT_ENV_VAR} is required for live estimate preflight`);
  }

  if (endpoint === ONESHOT_RELAYER_MAINNET_RPC_URL && !allowMainnetEndpoint) {
    issues.push("mainnet 1Shot relayer endpoint is blocked for Base Sepolia estimate preflight");
  }

  if (liveSendEnabled) {
    issues.push(`${LIVE_SEND_ENV_VAR} must remain disabled during estimate preflight`);
  }

  if (liveEstimateEnabled && !feePaymentExecution) {
    issues.push("1Shot fee payment execution is required for live estimate preflight");
  }

  if (
    liveEstimateEnabled &&
    dependencyPlan.status === DEPENDENCY_PLAN_STATUS.BLOCKED
  ) {
    issues.push(...dependencyPlan.issues);
  }

  if (effectivePermissionContext) {
    try {
      const executions = [];
      if (feePaymentExecution) {
        executions.push(feePaymentExecution);
      }
      if (estimateScenario !== ESTIMATE_SCENARIOS.FEE_ONLY) {
        executions.push(buildUsdcTransferExecution({usdcToken, recipient, amount}));
        grantExecutionIncluded = true;
      }
      if (executions.length === 0) {
        throw new Error("at least one execution is required for estimate construction");
      }
      estimateReport = buildBaseSepoliaEstimateRequestFromPermissionContext({
        permissionContext: effectivePermissionContext,
        executions,
        destinationUrl,
        memo,
        requestId,
      });
      firstDelegationDelegate = estimateReport.decoded.permissionContext[0]?.delegate ?? "";
    } catch (error) {
      issues.push(`permission context decode/estimate build failed: ${error.message}`);
    }
  }

  if (relayerTargetWallet) {
    try {
      expectedRelayerTargetWallet = normalizeAddress(relayerTargetWallet, RELAYER_TARGET_WALLET_ENV_VAR);
      if (firstDelegationDelegate && firstDelegationDelegate !== expectedRelayerTargetWallet) {
        issues.push(
          `first delegation delegate must match ${RELAYER_TARGET_WALLET_ENV_VAR} (${expectedRelayerTargetWallet}), got ${firstDelegationDelegate}`,
        );
      }
    } catch (error) {
      issues.push(`${RELAYER_TARGET_WALLET_ENV_VAR} is invalid: ${error.message}`);
    }
  }

  const blocked = issues.length > 0;
  const status = blocked
    ? ESTIMATE_PREFLIGHT_STATUS.BLOCKED
    : liveEstimateEnabled
      ? ESTIMATE_PREFLIGHT_STATUS.READY_LIVE_ESTIMATE
      : ESTIMATE_PREFLIGHT_STATUS.READY_DRY_RUN;

  return {
    step: 13,
    title: "1Shot live estimate preflight",
    status,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    endpoint,
    expectedEndpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
    realContextPresent: Boolean(effectivePermissionContext),
    fullGrantPresent: Boolean(permissionGrant),
    grantKeys: grantShape?.grantKeys ?? [],
    authorizationListPresent: grantShape?.authorizationListPresent ?? false,
    authorizationListCount: grantShape?.authorizationListCount ?? null,
    dependencyPlan,
    dependenciesPresent: dependencyPlan.dependenciesPresent,
    dependenciesDeployed: dependencyPlan.dependenciesDeployed,
    dependencyCount: dependencyPlan.dependencyCount,
    dependencyDeploymentCount: dependencyPlan.deployedCount,
    liveEstimateEnabled,
    liveSendEnabled,
    estimateScenario,
    feePaymentIncluded: Boolean(feePaymentExecution),
    grantExecutionIncluded,
    grantAmountAtoms: stringifyAmount(amount),
    feePaymentPlan,
    executionCount: estimateReport?.params.transactions[0]?.executions.length ?? 0,
    expectedRelayerTargetWallet,
    firstDelegationDelegate,
    delegateMatchesRelayerTarget: expectedRelayerTargetWallet
      ? firstDelegationDelegate === expectedRelayerTargetWallet
      : null,
    readyForNetworkEstimate: status === ESTIMATE_PREFLIGHT_STATUS.READY_LIVE_ESTIMATE,
    issues,
    estimateReport,
    noGoFor: status === ESTIMATE_PREFLIGHT_STATUS.READY_LIVE_ESTIMATE
      ? ["live_1shot_send", "live_payout_claim"]
      : ["live_1shot_estimate", "live_1shot_send", "live_payout_claim"],
  };
}

export function classifyOneShotEstimateResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      classification: ESTIMATE_RESULT_CLASSIFICATION.UNKNOWN,
      apiKeyAcceptedByRelayer: null,
      simulationReverted: false,
      selector: null,
      selectorLabel: null,
      reason: "estimate result was not an object",
    };
  }

  const errorText = readEstimateErrorText(result.error);
  const selector = errorText.includes(REDEEM_DELEGATIONS_SELECTOR) ? REDEEM_DELEGATIONS_SELECTOR : null;
  const simulationReverted = /estimateGas|revert|reverted|missing revert data/i.test(errorText);

  if (result.success === true) {
    return {
      classification: ESTIMATE_RESULT_CLASSIFICATION.SUCCEEDED,
      apiKeyAcceptedByRelayer: true,
      simulationReverted: false,
      selector: null,
      selectorLabel: null,
      reason: "1Shot returned a successful estimate result",
    };
  }

  if (result.success === false && simulationReverted) {
    return {
      classification: ESTIMATE_RESULT_CLASSIFICATION.SIMULATION_REVERT,
      apiKeyAcceptedByRelayer: true,
      simulationReverted: true,
      selector,
      selectorLabel: selector === REDEEM_DELEGATIONS_SELECTOR
        ? "redeemDelegations(bytes[],bytes32[],bytes[])"
        : null,
      reason: "1Shot accepted the request, but EVM gas simulation reverted",
    };
  }

  if (result.success === false) {
    return {
      classification: ESTIMATE_RESULT_CLASSIFICATION.FAILED,
      apiKeyAcceptedByRelayer: true,
      simulationReverted: false,
      selector,
      selectorLabel: null,
      reason: "1Shot accepted the request, but the estimate failed",
    };
  }

  return {
    classification: ESTIMATE_RESULT_CLASSIFICATION.UNKNOWN,
    apiKeyAcceptedByRelayer: true,
    simulationReverted,
    selector,
    selectorLabel: selector === REDEEM_DELEGATIONS_SELECTOR
      ? "redeemDelegations(bytes[],bytes32[],bytes[])"
      : null,
    reason: "1Shot returned a non-standard estimate result shape",
  };
}

export async function runOneShotEstimateAfterPreflight(preflight, options = {}) {
  if (!preflight?.readyForNetworkEstimate || !preflight.estimateReport) {
    throw new Error(`live estimate preflight is not ready: ${(preflight?.issues ?? []).join("; ") || "missing estimate report"}`);
  }

  return estimateOneShot7710Transaction(preflight.estimateReport.params, {
    endpoint: preflight.endpoint,
    id: options.id ?? 13,
    fetchImpl: options.fetchImpl,
  });
}

function readEstimateErrorText(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && !Array.isArray(error)) {
    return [
      error.name,
      error.code,
      error.message,
      error.reason,
      error.details,
    ]
      .filter((part) => part !== undefined && part !== null)
      .map(String)
      .join(" ");
  }

  return String(error);
}

export function formatOneShotEstimatePreflightLogs(preflight) {
  const lines = [
    `[1Shot] endpoint=${preflight.endpoint}.`,
    `[1Shot] Base Sepolia chainId=${preflight.chainId}.`,
    `[MetaMask] real context present=${preflight.realContextPresent}.`,
    `[MetaMask] full grant present=${preflight.fullGrantPresent}.`,
    `[MetaMask] dependencies=${preflight.dependencyCount}, deployed=${preflight.dependencyDeploymentCount}.`,
    `[MetaMask] authorizationList present=${preflight.authorizationListPresent}.`,
    `[SECURITY] ${LIVE_SEND_ENV_VAR} enabled=${preflight.liveSendEnabled}.`,
    `[1Shot] ${LIVE_ESTIMATE_ENV_VAR} enabled=${preflight.liveEstimateEnabled}.`,
  ];

  if (preflight.grantKeys.length > 0) {
    lines.push(`[MetaMask] grant keys=${preflight.grantKeys.join(", ")}.`);
  }

  if (preflight.estimateReport) {
    lines.push(`[1Shot] estimate method=${preflight.estimateReport.request.method}.`);
    lines.push(`[MetaMask] decoded delegations=${preflight.estimateReport.decoded.delegationCount}.`);
    lines.push(`[1Shot] estimate scenario=${preflight.estimateScenario}.`);
    lines.push(`[1Shot] execution count=${preflight.executionCount}.`);
  }
  if (preflight.firstDelegationDelegate) {
    lines.push(`[MetaMask] first delegation delegate=${preflight.firstDelegationDelegate}.`);
  }
  if (preflight.expectedRelayerTargetWallet) {
    lines.push(`[1Shot] expected relayer target=${preflight.expectedRelayerTargetWallet}.`);
    lines.push(`[1Shot] delegate target match=${preflight.delegateMatchesRelayerTarget}.`);
  }
  if (preflight.feePaymentIncluded) {
    lines.push("[1Shot] fee payment execution included=true.");
    if (preflight.feePaymentPlan?.feeCollector) {
      lines.push(`[1Shot] fee collector=${preflight.feePaymentPlan.feeCollector}.`);
    }
    if (preflight.feePaymentPlan?.mockFeeAtoms) {
      lines.push(`[1Shot] mock fee payment=${preflight.feePaymentPlan.mockFeeAtoms} atoms.`);
    }
  }

  if (preflight.issues.length > 0) {
    for (const issue of preflight.issues) {
      lines.push(`[NO-GO] ${issue}.`);
    }
  } else if (preflight.readyForNetworkEstimate) {
    lines.push("[CONDITIONAL GO] Live estimate may run; live send remains disabled.");
  } else {
    lines.push("[CONDITIONAL GO] Estimate request is ready; network call is still disabled.");
  }

  return lines;
}

function stringifyAmount(value) {
  try {
    return BigInt(value).toString();
  } catch {
    return String(value);
  }
}
