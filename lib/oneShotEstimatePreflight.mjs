import {createHash} from "node:crypto";

import {buildUsdcTransferExecution} from "./haloAgentBridge.mjs";
import {
  buildEstimateRequestFromPermissionContext,
} from "./metaMaskPermissionDecoder.mjs";
import {
  ONESHOT_RELAYER_MAINNET_RPC_URL,
  ONESHOT_RELAYER_RPC_URL,
  estimateOneShot7710Transaction,
} from "./oneShot.mjs";
import {
  ONESHOT_WEBHOOK_URL_ENV_VAR,
  isLiveOneShotWebhookUrlReady,
  resolveOneShotWebhookUrl,
} from "./oneShotWebhookUrl.mjs";
import {normalizeAddress} from "./hex.mjs";
import {
  DEPENDENCY_PLAN_STATUS,
  buildDependencyDeploymentPlan,
  normalizeAuthorizationList,
  parsePermissionGrantJson,
  summarizePermissionGrantShape,
} from "./metaMaskPermissionGrant.mjs";
import {
  HALO_CHAIN_PROFILE_ENV_VAR,
  HALO_CHAIN_PROFILES,
  HALO_MAINNET_MAX_RELAYER_FEE_USDC_ENV_VAR,
  decimalUsdcToAtoms,
  getHaloChainProfile,
} from "./chainProfiles.mjs";
import {
  SMART_ACCOUNT_7702_STATUS,
  classifySmartAccount7702Readiness,
} from "./metaMask7702Readiness.mjs";
import {
  A2A_REDELEGATION_LANES,
  buildA2ARedelegationProofReport,
} from "./a2aRedelegationProof.mjs";

export const LIVE_ESTIMATE_ENV_VAR = "HALO_ONESHOT_ESTIMATE_LIVE";
export const LIVE_SEND_ENV_VAR = "HALO_ONESHOT_LIVE";
export const METAMASK_CONTEXT_ENV_VAR = "HALO_METAMASK_PERMISSION_CONTEXT";
export const METAMASK_GRANT_ENV_VAR = "HALO_METAMASK_PERMISSION_GRANT_JSON";
export const RELAYER_TARGET_WALLET_ENV_VAR = "ONESHOT_RELAYER_TARGET_WALLET_ADDRESS";
export const ESTIMATE_SCENARIO_ENV_VAR = "HALO_ONESHOT_ESTIMATE_SCENARIO";
export {ONESHOT_WEBHOOK_URL_ENV_VAR};

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
  chainProfile = process.env.HALO_CHAIN_PROFILE,
  endpoint,
  liveEstimateEnabled = process.env.HALO_ONESHOT_ESTIMATE_LIVE === "1",
  liveSendEnabled = process.env.HALO_ONESHOT_LIVE === "1",
  allowMainnetEndpoint = process.env.HALO_ALLOW_MAINNET_RELAYER_ESTIMATE === "1",
  requireSmartAccountReadiness = process.env.HALO_REQUIRE_7702_READINESS === "1",
  requireA2A = process.env.HALO_A2A_REQUIRED === "1",
  a2aLane = process.env.HALO_A2A_LANE || A2A_REDELEGATION_LANES.TREASURER_PAYOUT,
  relayerTargetWallet = process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS,
  feePaymentExecution = null,
  feePaymentPlan = null,
  estimateScenario = process.env.HALO_ONESHOT_ESTIMATE_SCENARIO || ESTIMATE_SCENARIOS.FEE_AND_GRANT,
  accountCode,
  mainnetMaxGrantUsdc = process.env.HALO_MAINNET_DEMO_GRANT_USDC || "5",
  mainnetMaxRelayerFeeUsdc = process.env[HALO_MAINNET_MAX_RELAYER_FEE_USDC_ENV_VAR] || "0.50",
  extraIssues = [],
  usdcToken,
  recipient = "0x4444444444444444444444444444444444444444",
  amount = 25_000_000,
  destinationUrl,
  requestId = 13,
} = {}) {
  const issues = [...extraIssues];
  let profile = null;
  try {
    profile = getHaloChainProfile(chainProfile);
  } catch (error) {
    issues.push(error.message);
    profile = getHaloChainProfile(HALO_CHAIN_PROFILES.BASE_SEPOLIA);
  }
  const selectedEndpoint = endpoint ?? profile.relayerRpcUrl ?? process.env.ONESHOT_RELAYER_RPC_URL ?? ONESHOT_RELAYER_RPC_URL;
  const selectedUsdcToken = usdcToken ??
    process.env.HALO_USDC_ADDRESS ??
    (profile.mainnet ? profile.usdcAddress : process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS ?? profile.usdcAddress);
  let normalizedSelectedUsdcToken = selectedUsdcToken;
  try {
    normalizedSelectedUsdcToken = normalizeAddress(selectedUsdcToken, "USDC token");
  } catch (error) {
    issues.push(error.message);
  }
  const profileRequiresSmartAccountReadiness = requireSmartAccountReadiness || profile.mainnet;
  const resolvedDestinationUrl = resolveOneShotWebhookUrl(destinationUrl);
  let estimateReport = null;
  let expectedRelayerTargetWallet = "";
  let firstDelegationDelegate = "";
  let finalDelegationDelegate = "";
  let rootDelegator = "";
  let rootDelegate = "";
  let grantExecutionIncluded = false;
  let permissionGrant = null;
  let grantShape = null;
  let authorizationList = undefined;
  let smartAccountReadiness = classifySmartAccount7702Readiness({});
  let a2aProof = null;
  let dependencyPlan = buildDependencyDeploymentPlan({dependencies: [], deploymentTxs: []});

  try {
    permissionGrant = parsePermissionGrantJson(permissionGrantJson);
    if (permissionGrant) {
      grantShape = summarizePermissionGrantShape(permissionGrant);
      dependencyPlan = buildDependencyDeploymentPlan({
        grant: permissionGrant,
        deploymentTxs: dependencyDeploymentTxs,
      });
      authorizationList = normalizeAuthorizationList(permissionGrant.authorizationList);
    }
  } catch (error) {
    issues.push(error.message);
  }

  smartAccountReadiness = classifySmartAccount7702Readiness({
    accountCode: accountCode ?? permissionGrant?.accountCode ?? permissionGrant?.code ?? "0x",
    chainId: profile.chainId,
    authorizationList,
    dependencyCount: dependencyPlan.dependencyCount,
    dependenciesDeployed: dependencyPlan.dependenciesDeployed,
  });

  const effectivePermissionContext = permissionContext || permissionGrant?.context || "";

  if (!Object.values(ESTIMATE_SCENARIOS).includes(estimateScenario)) {
    issues.push(`${ESTIMATE_SCENARIO_ENV_VAR} must be one of: ${Object.values(ESTIMATE_SCENARIOS).join(", ")}`);
  }

  if (!effectivePermissionContext) {
    issues.push(`${METAMASK_CONTEXT_ENV_VAR} is required for live estimate preflight`);
  }

  if (selectedEndpoint === ONESHOT_RELAYER_MAINNET_RPC_URL && !profile.mainnet && !allowMainnetEndpoint) {
    issues.push(`mainnet 1Shot relayer endpoint requires ${HALO_CHAIN_PROFILE_ENV_VAR}=base-mainnet`);
  }

  if (profile.mainnet && selectedEndpoint !== ONESHOT_RELAYER_MAINNET_RPC_URL) {
    issues.push("Base mainnet profile must use the production 1Shot relayer endpoint");
  }

  let mainnetCapReport = null;
  if (profile.mainnet) {
    try {
      mainnetCapReport = buildMainnetPreflightCapReport({
        selectedUsdcToken: normalizedSelectedUsdcToken,
        expectedUsdcToken: profile.usdcAddress,
        grantAmountAtoms: amount,
        relayerFeeAtoms: feePaymentPlan?.initialFeeAtoms ?? feePaymentPlan?.mockFeeAtoms,
        maxGrantUsdc: mainnetMaxGrantUsdc,
        maxRelayerFeeUsdc: mainnetMaxRelayerFeeUsdc,
      });
      issues.push(...mainnetCapReport.issues);
    } catch (error) {
      issues.push(`mainnet cap validation failed: ${error.message}`);
    }
  }

  if (!profile.mainnet && selectedEndpoint === ONESHOT_RELAYER_MAINNET_RPC_URL && allowMainnetEndpoint) {
    issues.push("mainnet relayer endpoint override is not aligned with the Base Sepolia rehearsal profile");
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

  if (
    profileRequiresSmartAccountReadiness &&
    smartAccountReadiness.status === SMART_ACCOUNT_7702_STATUS.BLOCKED_NO_PATH
  ) {
    issues.push(...smartAccountReadiness.issues);
  }

  if (effectivePermissionContext) {
    try {
      const executions = [];
      if (feePaymentExecution) {
        executions.push(feePaymentExecution);
      }
      if (estimateScenario !== ESTIMATE_SCENARIOS.FEE_ONLY) {
        executions.push(buildUsdcTransferExecution({usdcToken: normalizedSelectedUsdcToken, recipient, amount}));
        grantExecutionIncluded = true;
      }
      if (executions.length === 0) {
        throw new Error("at least one execution is required for estimate construction");
      }
      estimateReport = buildEstimateRequestFromPermissionContext({
        permissionContext: effectivePermissionContext,
        executions,
        chainId: profile.chainId,
        destinationUrl: resolvedDestinationUrl,
        authorizationList,
        requestId,
      });
      rootDelegator = estimateReport.decoded.permissionContext[0]?.delegator ?? "";
      rootDelegate = estimateReport.decoded.permissionContext[0]?.delegate ?? "";
      firstDelegationDelegate = estimateReport.decoded.permissionContext[0]?.delegate ?? "";
      finalDelegationDelegate = estimateReport.decoded.permissionContext.at(-1)?.delegate ?? "";
    } catch (error) {
      issues.push(`permission context decode/estimate build failed: ${error.message}`);
    }
  }

  if (relayerTargetWallet) {
    try {
      expectedRelayerTargetWallet = normalizeAddress(relayerTargetWallet, RELAYER_TARGET_WALLET_ENV_VAR);
      if (finalDelegationDelegate && finalDelegationDelegate !== expectedRelayerTargetWallet) {
        issues.push(
          `final delegation delegate must match ${RELAYER_TARGET_WALLET_ENV_VAR} (${expectedRelayerTargetWallet}), got ${finalDelegationDelegate}`,
        );
      }
    } catch (error) {
      issues.push(`${RELAYER_TARGET_WALLET_ENV_VAR} is invalid: ${error.message}`);
    }
  }

  if (effectivePermissionContext && relayerTargetWallet) {
    try {
      a2aProof = buildA2ARedelegationProofReport({
        permissionContext: effectivePermissionContext,
        relayerTargetWallet,
        lane: a2aLane,
        estimateStatus: null,
      });
      if (requireA2A && !a2aProof.publicClaimAllowed) {
        issues.push(...a2aProof.issues);
      }
    } catch (error) {
      if (requireA2A) {
        issues.push(`A2A proof failed: ${error.message}`);
      }
    }
  } else if (requireA2A) {
    issues.push("A2A proof requires permission context and ONESHOT_RELAYER_TARGET_WALLET_ADDRESS");
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
    chainProfile: profile.id,
    chainLabel: profile.label,
    chainId: profile.chainId,
    endpoint: selectedEndpoint,
    expectedEndpoint: profile.relayerRpcUrl,
    destinationUrl: resolvedDestinationUrl,
    webhookUrlReadyForLiveSend: isLiveOneShotWebhookUrlReady(resolvedDestinationUrl),
    realContextPresent: Boolean(effectivePermissionContext),
    fullGrantPresent: Boolean(permissionGrant),
    grantKeys: grantShape?.grantKeys ?? [],
    authorizationListPresent: grantShape?.authorizationListPresent ?? false,
    authorizationListCount: grantShape?.authorizationListCount ?? null,
    authorizationListValid: grantShape?.authorizationListValid ?? true,
    authorizationListPassedThrough: Boolean(authorizationList),
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
    usdcToken: normalizedSelectedUsdcToken,
    baseMainnetUsdcToken: profile.mainnet ? normalizeAddress(profile.usdcAddress, "Base mainnet USDC") : null,
    mainnetCapReport,
    smartAccountReadiness,
    smartAccountReadyForLiveSend: smartAccountReadiness.readyForLiveSend,
    requireSmartAccountReadiness: profileRequiresSmartAccountReadiness,
    a2aProof,
    requireA2A,
    a2aLane,
    a2aPublicClaimAllowed: a2aProof?.publicClaimAllowed ?? false,
    feePaymentPlan,
    executionCount: estimateReport?.params.transactions[0]?.executions.length ?? 0,
    expectedRelayerTargetWallet,
    rootDelegator,
    rootDelegate,
    rootDelegatorHash: rootDelegator ? hashString(rootDelegator) : null,
    rootDelegateHash: rootDelegate ? hashString(rootDelegate) : null,
    firstDelegationDelegate,
    finalDelegationDelegate,
    finalDelegationDelegateHash: finalDelegationDelegate ? hashString(finalDelegationDelegate) : null,
    delegateMatchesRelayerTarget: expectedRelayerTargetWallet
      ? finalDelegationDelegate === expectedRelayerTargetWallet
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
    `[CHAIN] profile=${preflight.chainProfile ?? "unknown"}, label=${preflight.chainLabel ?? "unknown"}, chainId=${preflight.chainId}.`,
    `[CHAIN] USDC=${preflight.usdcToken ?? "unknown"}.`,
    `[1Shot] webhook callback=${preflight.destinationUrl ?? "missing"}.`,
    `[1Shot] webhook live-ready=${preflight.webhookUrlReadyForLiveSend}.`,
    `[MetaMask] real context present=${preflight.realContextPresent}.`,
    `[MetaMask] full grant present=${preflight.fullGrantPresent}.`,
    `[MetaMask] dependencies=${preflight.dependencyCount}, deployed=${preflight.dependencyDeploymentCount}.`,
    `[MetaMask] authorizationList present=${preflight.authorizationListPresent}.`,
    `[EIP-7702] readiness=${preflight.smartAccountReadiness?.status ?? "unknown"}.`,
    `[A2A] required=${preflight.requireA2A}, public claim allowed=${preflight.a2aPublicClaimAllowed}.`,
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
  if (preflight.finalDelegationDelegate) {
    lines.push(`[MetaMask] final delegation delegate=${preflight.finalDelegationDelegate}.`);
  }
  if (preflight.expectedRelayerTargetWallet) {
    lines.push(`[1Shot] expected relayer target=${preflight.expectedRelayerTargetWallet}.`);
    lines.push(`[1Shot] final delegate target match=${preflight.delegateMatchesRelayerTarget}.`);
  }
  if (preflight.a2aProof) {
    lines.push(`[A2A] delegation chain length=${preflight.a2aProof.delegationChainLength}.`);
    lines.push(`[A2A] proof status=${preflight.a2aProof.status}.`);
  }
  if (preflight.feePaymentIncluded) {
    lines.push("[1Shot] fee payment execution included=true.");
    if (preflight.feePaymentPlan?.feeCollector) {
      lines.push(`[1Shot] fee collector=${preflight.feePaymentPlan.feeCollector}.`);
    }
    const initialFeeAtoms = preflight.feePaymentPlan?.initialFeeAtoms ?? preflight.feePaymentPlan?.mockFeeAtoms;
    if (initialFeeAtoms) {
      lines.push(`[1Shot] initial fee payment=${initialFeeAtoms} atoms.`);
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

function buildMainnetPreflightCapReport({
  selectedUsdcToken,
  expectedUsdcToken,
  grantAmountAtoms,
  relayerFeeAtoms,
  maxGrantUsdc,
  maxRelayerFeeUsdc,
}) {
  const issues = [];
  const expectedToken = normalizeAddress(expectedUsdcToken, "Base mainnet USDC");
  const selectedToken = normalizeAddress(selectedUsdcToken, "selected USDC token");
  const maxGrantAtoms = decimalUsdcToAtoms(maxGrantUsdc, "mainnet demo grant cap");
  const maxRelayerFeeAtoms = decimalUsdcToAtoms(maxRelayerFeeUsdc, "mainnet relayer fee cap");
  const grantAtoms = BigInt(grantAmountAtoms);
  const feeAtoms = relayerFeeAtoms === undefined || relayerFeeAtoms === null || relayerFeeAtoms === ""
    ? null
    : BigInt(relayerFeeAtoms);

  if (selectedToken !== expectedToken) {
    issues.push(`Base mainnet preflight must use native Base USDC ${expectedToken}, got ${selectedToken}`);
  }
  if (grantAtoms > maxGrantAtoms) {
    issues.push(`mainnet demo grant ${grantAtoms.toString()} atoms exceeds Step 24 cap ${maxGrantAtoms.toString()}`);
  }
  if (feeAtoms !== null && feeAtoms > maxRelayerFeeAtoms) {
    issues.push(`mainnet relayer fee ${feeAtoms.toString()} atoms exceeds cap ${maxRelayerFeeAtoms.toString()}`);
  }

  return {
    selectedUsdcToken: selectedToken,
    expectedUsdcToken: expectedToken,
    usdcMatchesBaseMainnet: selectedToken === expectedToken,
    grantAmountAtoms: grantAtoms.toString(),
    relayerFeeAtoms: feeAtoms?.toString() ?? null,
    maxGrantAtoms: maxGrantAtoms.toString(),
    maxRelayerFeeAtoms: maxRelayerFeeAtoms.toString(),
    grantWithinCap: grantAtoms <= maxGrantAtoms,
    relayerFeeWithinCap: feeAtoms === null || feeAtoms <= maxRelayerFeeAtoms,
    issues,
  };
}

function hashString(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}
