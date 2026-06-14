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
    requiredPaymentAmount: result.requiredPaymentAmount ?? null,
    contextPresent: Boolean(result.context),
    contextByChainIdPresent: Boolean(result.contextByChainId),
    resultHash: hashJson(result),
  };
}

function summarizeFeePaymentPlan(plan) {
  if (!plan) {
    return null;
  }

  return {
    chainProfile: plan.chainProfile,
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
const pollStatusEnabled = process.env.HALO_STEP25_STATUS_POLL !== "0";
const pollAttempts = Number(process.env.HALO_STEP25_STATUS_POLL_ATTEMPTS || "6");
const pollIntervalMs = Number(process.env.HALO_STEP25_STATUS_POLL_INTERVAL_MS || "3000");
const grantAmountUsdc = process.env.HALO_MAINNET_DEMO_GRANT_USDC || "5";
const grantAmountAtoms = parseDecimalToAtoms(grantAmountUsdc);
const requesterAddress = process.env.HALO_STEP25_REQUESTER_ADDRESS || "";
let feePaymentPlan = null;
let feePaymentIssue = null;
let estimateResult = null;
let estimateSummary = null;
let estimateClassification = null;
let sendResult = null;
let statusPoll = null;
let sendIssue = null;

console.log("[HALO] Step 25 Base mainnet send + status/webhook terminal confirmation.");
console.log(`[SECURITY] HALO_ONESHOT_ESTIMATE_LIVE enabled=${liveEstimateRequested}.`);
console.log(`[SECURITY] HALO_ONESHOT_LIVE enabled=${liveSendRequested}.`);
console.log(`[SECURITY] HALO_MAINNET_DEMO_ARMED enabled=${process.env.HALO_MAINNET_DEMO_ARMED === "1"}.`);
console.log("[SECURITY] Step 25 will not print raw MetaMask context, estimate context, taskId, or tx hash.");
console.log("");

if (liveEstimateRequested) {
  console.log("[1Shot] Discovering Base mainnet fee payment plan.");
  try {
    feePaymentPlan = await fetchOneShotFeePaymentPlan({chainProfile: "base-mainnet"});
    console.log(`[1Shot] relayer target=${feePaymentPlan.targetAddress}.`);
    console.log(`[1Shot] fee collector=${feePaymentPlan.feeCollector}.`);
    console.log(`[1Shot] planned fee payment=${feePaymentPlan.mockFeeAtoms} atoms.`);
    console.log("");
  } catch (error) {
    feePaymentIssue = `1Shot mainnet fee payment plan failed: ${error.message}`;
    console.log(`[NO-GO] ${feePaymentIssue}.`);
    console.log("");
  }
}

const preflight = buildOneShotEstimatePreflight({
  chainProfile: "base-mainnet",
  requireSmartAccountReadiness: true,
  requireA2A: true,
  feePaymentExecution: feePaymentPlan?.execution ?? null,
  feePaymentPlan: summarizeFeePaymentPlan(feePaymentPlan),
  amount: grantAmountAtoms,
  mainnetMaxGrantUsdc: grantAmountUsdc,
  liveSendEnabled: false,
  relayerTargetWallet: feePaymentPlan?.targetAddress ?? process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS,
  extraIssues: [
    ...(liveEstimateRequested ? [] : ["HALO_ONESHOT_ESTIMATE_LIVE=1 is required for Step 25 fresh estimate"]),
    ...(liveSendRequested && !requesterAddress
      ? ["HALO_STEP25_REQUESTER_ADDRESS is required before live Step 25 send"]
      : []),
    ...(feePaymentIssue ? [feePaymentIssue] : []),
  ],
  recipient: requesterAddress || "0x4444444444444444444444444444444444444444",
  requestId: 25,
});

console.log("[HALO] Step 25 mainnet estimate preflight:");
for (const line of formatOneShotEstimatePreflightLogs(preflight)) {
  console.log(line);
}

if (preflight.readyForNetworkEstimate) {
  console.log("");
  console.log("[1Shot] Running Base mainnet live estimate. Send remains separately gated.");
  estimateResult = await runOneShotEstimateAfterPreflight(preflight, {id: 25});
  estimateSummary = summarizeEstimateResult(estimateResult);
  estimateClassification = classifyOneShotEstimateResult(estimateResult);
  console.log(JSON.stringify({...estimateSummary, classification: estimateClassification}, null, 2));
} else {
  console.log("");
  console.log("[1Shot] Mainnet estimate not called. Step 25 remains blocked.");
}

const rehearsal = buildOneShotLiveSendRehearsal({
  preflight,
  estimateResult,
  feePaymentPlan: summarizeFeePaymentPlan(feePaymentPlan),
  liveSendEnabled: liveSendRequested,
  requestId: 25,
});

console.log("");
console.log("[HALO] Step 25 mainnet live-send gate:");
for (const line of formatOneShotLiveSendRehearsalLogs(rehearsal)) {
  console.log(line);
}

if (rehearsal.readyForNetworkSend) {
  console.log("");
  console.log("[1Shot] Running armed Base mainnet send now.");
  try {
    sendResult = await runOneShotLiveSendAfterRehearsal(rehearsal, {id: 25});
    console.log("[1Shot] Mainnet send result summary:");
    console.log(JSON.stringify(summarizeOneShotSendResult(sendResult), null, 2));
  } catch (error) {
    sendIssue = `1Shot mainnet send failed: ${error.message}`;
    console.log(`[NO-GO] ${sendIssue}.`);
  }
} else {
  console.log("");
  console.log("[1Shot] Mainnet send not called.");
}

const taskId = extractOneShotTaskId(sendResult);
if (taskId && pollStatusEnabled) {
  console.log("");
  console.log("[1Shot] Polling Base mainnet relayer status for returned task id.");
  try {
    statusPoll = await pollOneShotRelayStatus({
      taskId,
      endpoint: rehearsal.endpoint,
      attempts: pollAttempts,
      intervalMs: pollIntervalMs,
      logs: true,
      id: 25,
    });
  } catch (error) {
    sendIssue = `1Shot mainnet status poll failed: ${error.message}`;
    console.log(`[NO-GO] ${sendIssue}.`);
  }
}

const confirmation = buildRelayConfirmationReport({
  liveSendEnabled: liveSendRequested,
  sendResult,
  statusPoll,
  sendIssues: [...rehearsal.issues, ...(sendIssue ? [sendIssue] : [])],
});

console.log("");
console.log("[HALO] Step 25 mainnet relay confirmation:");
for (const line of formatRelayConfirmationLogs(confirmation)) {
  console.log(line);
}

console.log(
  JSON.stringify(
    {
      step: 25,
      status: confirmation.status,
      chainProfile: rehearsal.chainProfile,
      chainId: rehearsal.chainId,
      endpoint: rehearsal.endpoint,
      liveEstimateEnabled: liveEstimateRequested,
      liveSendEnabled: liveSendRequested,
      mainnetReadiness: rehearsal.mainnetReadiness,
      a2aProof: preflight.a2aProof,
      smartAccountReadiness: preflight.smartAccountReadiness,
      estimateResultHash: estimateSummary?.resultHash ?? null,
      taskIdPresent: confirmation.taskIdPresent,
      taskIdHash: confirmation.taskIdHash,
      grantStatus: confirmation.grantStatus,
      rawStatus: confirmation.rawStatus,
      txHashPresent: confirmation.txHashPresent,
      txHashHash: confirmation.txHashHash,
      issues: confirmation.issues,
    },
    null,
    2,
  ),
);
