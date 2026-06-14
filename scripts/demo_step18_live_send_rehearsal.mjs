import {createHash} from "node:crypto";

import {
  buildOneShotEstimatePreflight,
  classifyOneShotEstimateResult,
  formatOneShotEstimatePreflightLogs,
  runOneShotEstimateAfterPreflight,
} from "../lib/oneShotEstimatePreflight.mjs";
import {
  buildOneShotLiveSendRehearsal,
  formatOneShotLiveSendRehearsalLogs,
  runOneShotLiveSendAfterRehearsal,
} from "../lib/oneShotLiveSendRehearsal.mjs";
import {parseDecimalToAtoms} from "../lib/haloPermissions.mjs";
import {fetchOneShotFeePaymentPlan} from "../lib/oneShotFeePlan.mjs";

function hashJson(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function summarizeEstimateResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      resultType: typeof result,
      resultHash: hashJson(result),
    };
  }

  return {
    resultKeys: Object.keys(result).sort(),
    success: typeof result.success === "boolean" ? result.success : null,
    gasUsed: result.gasUsed ?? null,
    error: summarizeError(result.error),
    requiredPaymentAmount: result.requiredPaymentAmount ?? null,
    contextPresent: Boolean(result.context),
    contextByChainIdPresent: Boolean(result.contextByChainId),
    resultHash: hashJson(result),
  };
}

function summarizeError(error) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error.slice(0, 240);
  }

  if (typeof error === "object" && !Array.isArray(error)) {
    return {
      code: error.code ?? null,
      message: typeof error.message === "string" ? error.message.slice(0, 240) : null,
      name: typeof error.name === "string" ? error.name : null,
    };
  }

  return String(error).slice(0, 240);
}

function summarizeFeePaymentPlan(plan) {
  if (!plan) {
    return null;
  }

  return {
    chainId: plan.chainId,
    token: plan.token,
    tokenSymbol: plan.tokenSymbol,
    targetAddress: plan.targetAddress,
    feeCollector: plan.feeCollector,
    minFeeAtoms: plan.minFeeAtoms,
    mockFeeAtoms: plan.mockFeeAtoms,
    mockFeeUsdc: plan.mockFeeUsdc,
    contextPresent: plan.contextPresent,
    requiredPaymentAmount: plan.requiredPaymentAmount,
  };
}

function formatUsdcAtoms(atoms, decimals = 6) {
  try {
    const value = BigInt(atoms);
    const scale = 10n ** BigInt(decimals);
    const whole = value / scale;
    const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
    return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  } catch {
    return null;
  }
}

function summarizeSendResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      resultType: typeof result,
      resultHash: hashJson(result),
    };
  }

  return {
    resultKeys: Object.keys(result).sort(),
    taskIdPresent: Boolean(result.taskId ?? result.id),
    taskIdHash: result.taskId || result.id ? hashJson(String(result.taskId ?? result.id)) : null,
    resultHash: hashJson(result),
  };
}

const liveEstimateRequested = process.env.HALO_ONESHOT_ESTIMATE_LIVE === "1";
const liveSendRequested = process.env.HALO_ONESHOT_LIVE === "1";
const estimateScenario = process.env.HALO_ONESHOT_ESTIMATE_SCENARIO || "fee_and_grant";
const grantAmountUsdc = process.env.HALO_STEP18_GRANT_USDC || process.env.HALO_STEP16_GRANT_USDC || "25";
const grantAmountAtoms = parseDecimalToAtoms(grantAmountUsdc);
let feePaymentPlan = null;
let feePaymentIssue = null;
let estimateResult = null;
let estimateSummary = null;
let estimateClassification = null;

console.log(`[SECURITY] HALO_ONESHOT_ESTIMATE_LIVE enabled=${liveEstimateRequested}.`);
console.log(`[SECURITY] HALO_ONESHOT_LIVE enabled=${liveSendRequested}.`);
console.log("[SECURITY] Step 18 will not print raw MetaMask context or 1Shot estimate context.");
console.log("");

if (liveEstimateRequested) {
  console.log("[1Shot] Discovering fee payment plan before live-send rehearsal.");
  try {
    feePaymentPlan = await fetchOneShotFeePaymentPlan();
    console.log(`[1Shot] fee collector=${feePaymentPlan.feeCollector}.`);
    console.log(`[1Shot] relayer target=${feePaymentPlan.targetAddress}.`);
    console.log(`[1Shot] planned fee payment=${feePaymentPlan.mockFeeAtoms} atoms.`);
    console.log("");
  } catch (error) {
    feePaymentIssue = `1Shot fee payment plan failed: ${error.message}`;
    console.log(`[NO-GO] ${feePaymentIssue}.`);
    console.log("");
  }
}

const preflight = buildOneShotEstimatePreflight({
  feePaymentExecution: feePaymentPlan?.execution ?? null,
  feePaymentPlan: summarizeFeePaymentPlan(feePaymentPlan),
  estimateScenario,
  amount: grantAmountAtoms,
  liveSendEnabled: false,
  relayerTargetWallet: feePaymentPlan?.targetAddress ?? process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS,
  extraIssues: [
    ...(liveEstimateRequested ? [] : ["HALO_ONESHOT_ESTIMATE_LIVE=1 is required for Step 18 fresh estimate"]),
    ...(feePaymentIssue ? [feePaymentIssue] : []),
  ],
  requestId: 18,
});

console.log("[HALO] Step 18 fresh estimate preflight:");
for (const line of formatOneShotEstimatePreflightLogs(preflight)) {
  console.log(line);
}

if (preflight.readyForNetworkEstimate) {
  console.log("");
  console.log("[1Shot] Running fresh live estimate for Step 18. Live send remains separately gated.");
  estimateResult = await runOneShotEstimateAfterPreflight(preflight, {id: 18});
  estimateSummary = summarizeEstimateResult(estimateResult);
  estimateClassification = classifyOneShotEstimateResult(estimateResult);
  console.log("[1Shot] Fresh estimate result summary:");
  console.log(JSON.stringify({...estimateSummary, classification: estimateClassification}, null, 2));
} else {
  console.log("");
  console.log("[1Shot] Fresh estimate not called. Step 18 remains blocked.");
}

const rehearsal = buildOneShotLiveSendRehearsal({
  preflight,
  estimateResult,
  feePaymentPlan: summarizeFeePaymentPlan(feePaymentPlan),
  liveSendEnabled: liveSendRequested,
  requestId: 18,
});

console.log("");
console.log("[HALO] Step 18 live-send rehearsal gate:");
for (const line of formatOneShotLiveSendRehearsalLogs(rehearsal)) {
  console.log(line);
}

console.log(
  JSON.stringify(
    {
      step: 18,
      status: rehearsal.status,
      chainId: rehearsal.chainId,
      endpoint: rehearsal.endpoint,
      liveEstimateEnabled: liveEstimateRequested,
      liveSendEnabled: rehearsal.liveSendEnabled,
      estimateSucceeded: rehearsal.estimateSucceeded,
      estimateContextPresent: rehearsal.estimateContextPresent,
      requiredPaymentAmount: rehearsal.requiredPaymentAmount,
      plannedFeeAmount: rehearsal.plannedFeeAmount,
      feePaymentMatchesEstimate: rehearsal.feePaymentMatchesEstimate,
      executionCount: rehearsal.executionCount,
      readyForNetworkSend: rehearsal.readyForNetworkSend,
      sendMethod: rehearsal.sendRequest?.method ?? null,
      estimateResultHash: estimateSummary?.resultHash ?? null,
      estimateContextHash: rehearsal.estimateContextHash,
      issues: rehearsal.issues,
    },
    null,
    2,
  ),
);

if (!rehearsal.readyForNetworkSend) {
  console.log("");
  console.log("[1Shot] Network send not called.");
  const requiredFeeUsdc = rehearsal.requiredPaymentAmount ? formatUsdcAtoms(rehearsal.requiredPaymentAmount) : null;
  if (requiredFeeUsdc && !rehearsal.feePaymentMatchesEstimate) {
    console.log(
      `[NEXT] Rerun estimate with HALO_ONESHOT_ESTIMATE_MOCK_FEE_USDC=${requiredFeeUsdc} so the fee execution matches the quote before enabling send.`,
    );
  }
} else {
  console.log("");
  console.log("[1Shot] Running live testnet send now.");
  const sendResult = await runOneShotLiveSendAfterRehearsal(rehearsal, {id: 18});
  console.log("[1Shot] Live send result summary:");
  console.log(JSON.stringify(summarizeSendResult(sendResult), null, 2));
  console.log("[NEXT] Poll relayer status and wait for signed webhook before marking any grant paid.");
}
