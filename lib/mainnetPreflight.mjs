import {createHash} from "node:crypto";

import {buildA2ARedelegationPublicSummary} from "./a2aRedelegationProof.mjs";
import {BASE_MAINNET_CHAIN_ID, BASE_MAINNET_USDC_ADDRESS} from "./chainProfiles.mjs";
import {ESTIMATE_RESULT_CLASSIFICATION, classifyOneShotEstimateResult} from "./oneShotEstimatePreflight.mjs";
import {ONESHOT_RELAYER_MAINNET_RPC_URL} from "./oneShot.mjs";

export const STEP24_MAINNET_PREFLIGHT_STATUS = Object.freeze({
  BLOCKED: "NO_GO_MAINNET_PREFLIGHT_BLOCKED",
  ESTIMATE_SUCCEEDED: "CONDITIONAL_GO_MAINNET_ESTIMATE_SUCCEEDED",
  REPRICE_REQUIRED: "CONDITIONAL_GO_MAINNET_REPRICE_REQUIRED",
});

export function classifyStep24MainnetPreflight({
  preflight,
  estimateResult,
  feePaymentPlan,
  liveSendInputWasEnabled = false,
  extraIssues = [],
} = {}) {
  const issues = [...(preflight?.issues ?? []), ...extraIssues];
  const estimateClassification = classifyOneShotEstimateResult(estimateResult);
  const requiredPaymentAmount = normalizeOptionalAmount(estimateResult?.requiredPaymentAmount);
  const plannedFeeAmount = normalizeOptionalAmount(feePaymentPlan?.initialFeeAtoms ?? feePaymentPlan?.mockFeeAtoms);

  if (!preflight?.readyForNetworkEstimate) {
    issues.push("Step 24 requires a ready Base mainnet estimate preflight before the network estimate can run");
  }
  if (!estimateResult) {
    issues.push("Step 24 requires a live 1Shot estimate result");
  }
  if (
    estimateResult &&
    estimateClassification.classification !== ESTIMATE_RESULT_CLASSIFICATION.SUCCEEDED
  ) {
    issues.push("1Shot mainnet estimate must return success=true");
  }
  if (estimateResult && requiredPaymentAmount === null) {
    issues.push("1Shot estimate requiredPaymentAmount is required before Step 25");
  }
  if (estimateResult && plannedFeeAmount === null) {
    issues.push("planned initial relayer fee amount is required before Step 25");
  }

  if (issues.length > 0) {
    return buildStatusReport({
      status: STEP24_MAINNET_PREFLIGHT_STATUS.BLOCKED,
      issues,
      estimateClassification,
      requiredPaymentAmount,
      plannedFeeAmount,
      liveSendInputWasEnabled,
    });
  }

  if (requiredPaymentAmount !== plannedFeeAmount) {
    return buildStatusReport({
      status: STEP24_MAINNET_PREFLIGHT_STATUS.REPRICE_REQUIRED,
      issues: [
        `estimate requiredPaymentAmount ${requiredPaymentAmount.toString()} atoms differs from initial fee ${plannedFeeAmount.toString()} atoms; rebuild and re-sign before Step 25`,
      ],
      estimateClassification,
      requiredPaymentAmount,
      plannedFeeAmount,
      liveSendInputWasEnabled,
    });
  }

  return buildStatusReport({
    status: STEP24_MAINNET_PREFLIGHT_STATUS.ESTIMATE_SUCCEEDED,
    issues: [],
    estimateClassification,
    requiredPaymentAmount,
    plannedFeeAmount,
    liveSendInputWasEnabled,
  });
}

export function buildStep24MainnetPreflightPublicSummary({
  preflight,
  estimateResult,
  feePaymentPlan,
  statusReport,
  accountCodeLookup = null,
  relayerTargetSource = "unknown",
} = {}) {
  const report = statusReport ?? classifyStep24MainnetPreflight({preflight, estimateResult, feePaymentPlan});
  const smartAccountReadiness = sanitizeSmartAccountReadiness(preflight?.smartAccountReadiness);
  const a2aProof = preflight?.a2aProof
    ? buildA2ARedelegationPublicSummary({report: preflight.a2aProof, relayerTargetIsPublic: true})
    : null;
  const relayerTargetWallet = preflight?.expectedRelayerTargetWallet || feePaymentPlan?.targetAddress || null;

  return {
    step: 24,
    title: "Base mainnet preflight",
    status: report.status,
    publicStep24ClaimAllowed: report.status !== STEP24_MAINNET_PREFLIGHT_STATUS.BLOCKED,
    chainProfile: preflight?.chainProfile ?? null,
    chainId: preflight?.chainId ?? null,
    baseMainnetChainId: BASE_MAINNET_CHAIN_ID,
    endpoint: preflight?.endpoint ?? null,
    productionRelayerEndpoint: ONESHOT_RELAYER_MAINNET_RPC_URL,
    productionEndpointSelected: preflight?.endpoint === ONESHOT_RELAYER_MAINNET_RPC_URL,
    usdcToken: preflight?.usdcToken ?? null,
    baseMainnetUsdc: BASE_MAINNET_USDC_ADDRESS,
    usdcMatchesBaseMainnet: Boolean(preflight?.mainnetCapReport?.usdcMatchesBaseMainnet),
    liveEstimateEnabled: Boolean(preflight?.liveEstimateEnabled),
    liveSendEnabled: false,
    liveSendInputWasEnabled: Boolean(report.liveSendInputWasEnabled),
    liveSendInputOverridden: Boolean(report.liveSendInputWasEnabled),
    relayerTargetSource,
    relayerTargetWallet,
    relayerTargetWalletHash: relayerTargetWallet ? hashString(relayerTargetWallet) : null,
    finalDelegationDelegateHash: preflight?.finalDelegationDelegateHash ?? null,
    delegateMatchesRelayerTarget: preflight?.delegateMatchesRelayerTarget ?? null,
    rootDelegatorHash: preflight?.rootDelegatorHash ?? null,
    rootDelegateHash: preflight?.rootDelegateHash ?? null,
    smartAccountReadiness,
    accountCodeLookup: sanitizeAccountCodeLookup(accountCodeLookup),
    a2aProof,
    mainnetCapReport: preflight?.mainnetCapReport ?? null,
    grantAmountAtoms: preflight?.grantAmountAtoms ?? null,
    initialRelayerFeeAtoms: report.plannedFeeAmount?.toString() ?? null,
    estimateSummary: summarizeEstimateResultPublic(estimateResult),
    estimateClassification: report.estimateClassification,
    oneShotSend: false,
    taskIdPresent: false,
    webhookMutation: false,
    statusMutation: false,
    paidClaim: false,
    mainnetSend: false,
    issues: report.issues,
    noGoFor: report.noGoFor,
  };
}

export function formatStep24MainnetPreflightLogs(summary) {
  const lines = [
    `[CHAIN] profile=${summary.chainProfile}, chainId=${summary.chainId}.`,
    `[CHAIN] endpoint=${summary.endpoint}.`,
    `[CHAIN] production endpoint selected=${summary.productionEndpointSelected}.`,
    `[CHAIN] Base mainnet USDC=${summary.usdcToken}.`,
    `[CHAIN] USDC matches native Base=${summary.usdcMatchesBaseMainnet}.`,
    `[1Shot] relayer target source=${summary.relayerTargetSource}.`,
    `[1Shot] relayer target=${summary.relayerTargetWallet ?? "missing"}.`,
    `[1Shot] final delegate matches target=${summary.delegateMatchesRelayerTarget}.`,
    `[CAPS] grant=${summary.grantAmountAtoms ?? "missing"} atoms, max=${summary.mainnetCapReport?.maxGrantAtoms ?? "missing"} atoms.`,
    `[CAPS] initial relayer fee=${summary.initialRelayerFeeAtoms ?? "missing"} atoms, max=${summary.mainnetCapReport?.maxRelayerFeeAtoms ?? "missing"} atoms.`,
    `[EIP-7702] readiness=${summary.smartAccountReadiness?.status ?? "unknown"}.`,
    `[EIP-7702] code lookup=${summary.accountCodeLookup?.status ?? "not_run"}.`,
    `[A2A] proof status=${summary.a2aProof?.status ?? "missing"}.`,
    `[A2A] delegation chain length=${summary.a2aProof?.delegationChainLength ?? 0}.`,
    `[1Shot] live estimate enabled=${summary.liveEstimateEnabled}.`,
    `[SECURITY] live send enabled=${summary.liveSendEnabled}.`,
    `[SECURITY] live send input overridden=${summary.liveSendInputOverridden}.`,
    `[BOUNDARY] No TaskId, webhook mutation, /status mutation, paid claim, or mainnet send.`,
  ];

  if (summary.estimateSummary) {
    lines.push(`[1Shot] estimate success=${summary.estimateSummary.success}.`);
    lines.push(`[1Shot] required payment=${summary.estimateSummary.requiredPaymentAmount ?? "missing"} atoms.`);
    lines.push(`[1Shot] estimate context present=${summary.estimateSummary.contextPresent}.`);
  }

  if (summary.status === STEP24_MAINNET_PREFLIGHT_STATUS.BLOCKED) {
    for (const issue of summary.issues) {
      lines.push(`[NO-GO] ${issue}.`);
    }
  } else if (summary.status === STEP24_MAINNET_PREFLIGHT_STATUS.REPRICE_REQUIRED) {
    lines.push("[CONDITIONAL GO] Mainnet estimate succeeded, but Step 25 requires reprice/re-sign before send.");
    for (const issue of summary.issues) {
      lines.push(`[REPRICE] ${issue}.`);
    }
  } else {
    lines.push("[CONDITIONAL GO] Base mainnet estimate succeeded. Step 25 remains separately gated.");
  }

  return lines;
}

function buildStatusReport({
  status,
  issues,
  estimateClassification,
  requiredPaymentAmount,
  plannedFeeAmount,
  liveSendInputWasEnabled,
}) {
  return {
    status,
    issues,
    estimateClassification,
    requiredPaymentAmount,
    plannedFeeAmount,
    liveSendInputWasEnabled,
    noGoFor: status === STEP24_MAINNET_PREFLIGHT_STATUS.BLOCKED
      ? ["mainnet_preflight_claim", "live_1shot_send", "paid_grant_claim", "mainnet_send"]
      : ["live_1shot_send", "paid_grant_claim", "mainnet_send"],
  };
}

function summarizeEstimateResultPublic(result) {
  if (!result) {
    return null;
  }

  if (typeof result !== "object" || Array.isArray(result)) {
    return {
      resultType: typeof result,
      resultHash: hashJson(result),
    };
  }

  return {
    resultKeys: Object.keys(result).sort(),
    success: typeof result.success === "boolean" ? result.success : null,
    gasUsed: result.gasUsed ?? null,
    requiredPaymentAmount: result.requiredPaymentAmount ?? null,
    contextPresent: Boolean(result.context),
    contextByChainIdPresent: Boolean(result.contextByChainId),
    resultHash: hashJson(result),
  };
}

function sanitizeSmartAccountReadiness(report) {
  if (!report) {
    return null;
  }

  return {
    status: report.status,
    readyForLiveSend: Boolean(report.readyForLiveSend),
    hasCode: Boolean(report.hasCode),
    codeHash: report.code && report.code !== "0x" ? hashString(report.code) : null,
    eip7702DelegatorHash: report.eip7702Delegator ? hashString(report.eip7702Delegator) : null,
    expectedDelegatorHash: report.expectedDelegator ? hashString(report.expectedDelegator) : null,
    authorizationCount: report.authorizationCount,
    dependencyCount: report.dependencyCount,
    dependenciesDeployed: report.dependenciesDeployed,
    issues: report.issues ?? [],
    noGoFor: report.noGoFor ?? [],
  };
}

function sanitizeAccountCodeLookup(lookup) {
  if (!lookup) {
    return null;
  }

  return {
    attempted: Boolean(lookup.attempted),
    status: lookup.status,
    addressHash: lookup.address ? hashString(lookup.address) : null,
    codePresent: Boolean(lookup.codePresent),
    issue: lookup.issue ?? null,
  };
}

function normalizeOptionalAmount(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return BigInt(value);
}

function hashJson(value) {
  return hashString(JSON.stringify(value));
}

function hashString(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}
