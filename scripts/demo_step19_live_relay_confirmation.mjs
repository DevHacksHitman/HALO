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
import {
  buildRelayConfirmationReport,
  extractOneShotTaskId,
  formatRelayConfirmationLogs,
  pollOneShotRelayStatus,
  summarizeOneShotSendResult,
} from "../lib/oneShotRelayConfirmation.mjs";
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

const liveEstimateRequested = process.env.HALO_ONESHOT_ESTIMATE_LIVE === "1";
const liveSendRequested = process.env.HALO_ONESHOT_LIVE === "1";
const pollStatusEnabled = process.env.HALO_STEP19_STATUS_POLL !== "0";
const pollAttempts = Number(process.env.HALO_STEP19_STATUS_POLL_ATTEMPTS || "4");
const pollIntervalMs = Number(process.env.HALO_STEP19_STATUS_POLL_INTERVAL_MS || "2500");
const estimateScenario = process.env.HALO_ONESHOT_ESTIMATE_SCENARIO || "fee_and_grant";
const grantAmountUsdc = process.env.HALO_STEP19_GRANT_USDC || process.env.HALO_STEP18_GRANT_USDC || process.env.HALO_STEP16_GRANT_USDC || "25";
const grantAmountAtoms = parseDecimalToAtoms(grantAmountUsdc);
const requesterAddress = process.env.HALO_STEP19_REQUESTER_ADDRESS || "";
const fallbackDryRunRequester = "0x4444444444444444444444444444444444444444";
let feePaymentPlan = null;
let feePaymentIssue = null;
let estimateResult = null;
let estimateSummary = null;
let estimateClassification = null;
let sendResult = null;
let statusPoll = null;
let sendIssue = null;

console.log(`[SECURITY] HALO_ONESHOT_ESTIMATE_LIVE enabled=${liveEstimateRequested}.`);
console.log(`[SECURITY] HALO_ONESHOT_LIVE enabled=${liveSendRequested}.`);
console.log("[SECURITY] Step 19 will not print raw MetaMask context, 1Shot estimate context, taskId, or tx hash.");
console.log(`[SECURITY] Step 19 requester configured=${Boolean(requesterAddress)}.`);
console.log("");

if (liveEstimateRequested) {
  console.log("[1Shot] Discovering fee payment plan before Step 19 relay confirmation.");
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
    ...(liveEstimateRequested ? [] : ["HALO_ONESHOT_ESTIMATE_LIVE=1 is required for Step 19 fresh estimate"]),
    ...(liveSendRequested && !requesterAddress
      ? ["HALO_STEP19_REQUESTER_ADDRESS is required before live Step 19 send"]
      : []),
    ...(feePaymentIssue ? [feePaymentIssue] : []),
  ],
  recipient: requesterAddress || fallbackDryRunRequester,
  memo: "Halo Step 19 live relay confirmation",
  requestId: 19,
});

console.log("[HALO] Step 19 fresh estimate preflight:");
for (const line of formatOneShotEstimatePreflightLogs(preflight)) {
  console.log(line);
}

if (preflight.readyForNetworkEstimate) {
  console.log("");
  console.log("[1Shot] Running fresh live estimate for Step 19. Live send remains separately gated.");
  estimateResult = await runOneShotEstimateAfterPreflight(preflight, {id: 19});
  estimateSummary = summarizeEstimateResult(estimateResult);
  estimateClassification = classifyOneShotEstimateResult(estimateResult);
  console.log("[1Shot] Fresh estimate result summary:");
  console.log(JSON.stringify({...estimateSummary, classification: estimateClassification}, null, 2));
} else {
  console.log("");
  console.log("[1Shot] Fresh estimate not called. Step 19 remains blocked.");
}

const rehearsal = buildOneShotLiveSendRehearsal({
  preflight,
  estimateResult,
  feePaymentPlan: summarizeFeePaymentPlan(feePaymentPlan),
  liveSendEnabled: liveSendRequested,
  requestId: 19,
});

console.log("");
console.log("[HALO] Step 19 live-send gate:");
for (const line of formatOneShotLiveSendRehearsalLogs(rehearsal)) {
  console.log(line);
}

if (rehearsal.readyForNetworkSend) {
  console.log("");
  console.log("[1Shot] Running live testnet send now.");
  try {
    sendResult = await runOneShotLiveSendAfterRehearsal(rehearsal, {id: 19});
    const sendSummary = summarizeOneShotSendResult(sendResult);
    console.log("[1Shot] Live send result summary:");
    console.log(JSON.stringify(sendSummary, null, 2));
  } catch (error) {
    sendIssue = `1Shot live send failed: ${error.message}`;
    console.log(`[NO-GO] ${sendIssue}.`);
  }
} else {
  console.log("");
  console.log("[1Shot] Network send not called.");
}

const taskId = extractOneShotTaskId(sendResult);
if (taskId && pollStatusEnabled) {
  console.log("");
  console.log("[1Shot] Polling relayer status for returned task id.");
  try {
    statusPoll = await pollOneShotRelayStatus({
      taskId,
      endpoint: rehearsal.endpoint,
      attempts: pollAttempts,
      intervalMs: pollIntervalMs,
      logs: true,
      id: 19,
    });
  } catch (error) {
    sendIssue = `1Shot status poll failed: ${error.message}`;
    console.log(`[NO-GO] ${sendIssue}.`);
  }
} else if (taskId && !pollStatusEnabled) {
  console.log("");
  console.log("[1Shot] Status polling skipped by HALO_STEP19_STATUS_POLL=0.");
}

const confirmation = buildRelayConfirmationReport({
  liveSendEnabled: liveSendRequested,
  sendResult,
  statusPoll,
  sendIssues: [...rehearsal.issues, ...(sendIssue ? [sendIssue] : [])],
});

console.log("");
console.log("[HALO] Step 19 relay confirmation:");
for (const line of formatRelayConfirmationLogs(confirmation)) {
  console.log(line);
}

console.log(
  JSON.stringify(
    {
      step: 19,
      status: confirmation.status,
      chainId: rehearsal.chainId,
      endpoint: rehearsal.endpoint,
      liveEstimateEnabled: liveEstimateRequested,
      liveSendEnabled: liveSendRequested,
      estimateSucceeded: rehearsal.estimateSucceeded,
      requiredPaymentAmount: rehearsal.requiredPaymentAmount,
      plannedFeeAmount: rehearsal.plannedFeeAmount,
      feePaymentMatchesEstimate: rehearsal.feePaymentMatchesEstimate,
      requesterConfigured: Boolean(requesterAddress),
      readyForNetworkSend: rehearsal.readyForNetworkSend,
      taskIdPresent: confirmation.taskIdPresent,
      taskIdHash: confirmation.taskIdHash,
      statusPollAttempts: confirmation.statusPollAttempts,
      grantStatus: confirmation.grantStatus,
      rawStatus: confirmation.rawStatus,
      txHashPresent: confirmation.txHashPresent,
      txHashHash: confirmation.txHashHash,
      estimateResultHash: estimateSummary?.resultHash ?? null,
      sendResultHash: confirmation.sendResultHash,
      statusResultHash: confirmation.statusResultHash,
      issues: confirmation.issues,
    },
    null,
    2,
  ),
);

console.log("");
console.log("[NEXT] Do not mark a grant paid publicly until relayer status or signed webhook confirms it.");
