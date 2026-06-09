import {createHash} from "node:crypto";

import {createPublicClient, http, parseAbi} from "viem";
import {baseSepolia} from "viem/chains";

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
import {
  buildBalanceTargetSummary,
  buildRelayReconciliationReport,
  formatRelayReconciliationLogs,
} from "../lib/relayReconciliation.mjs";
import {BASE_SEPOLIA_USDC_ADDRESS, parseDecimalToAtoms} from "../lib/haloPermissions.mjs";
import {fetchOneShotFeePaymentPlan} from "../lib/oneShotFeePlan.mjs";
import {normalizeAddress} from "../lib/hex.mjs";
import {parsePermissionGrantJson} from "../lib/metaMaskPermissionGrant.mjs";

const erc20Abi = parseAbi(["function balanceOf(address account) view returns (uint256)"]);

function hashJson(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function summarizeEstimateResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      resultType: Array.isArray(result) ? "array" : result === null ? "null" : typeof result,
      resultHash: hashJson(result),
    };
  }

  return {
    resultType: "object",
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

function createBaseSepoliaClient() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
}

async function readUsdcBalances({client, usdcToken, donorAddress, requesterAddress, feeCollector}) {
  if (!client) {
    return null;
  }

  const [donor, requester, collector] = await Promise.all([
    readBalance({client, token: usdcToken, address: donorAddress}),
    readBalance({client, token: usdcToken, address: requesterAddress}),
    readBalance({client, token: usdcToken, address: feeCollector}),
  ]);

  return {
    donor: donor.toString(),
    requester: requester.toString(),
    feeCollector: collector.toString(),
  };
}

async function readBalance({client, token, address}) {
  return client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const liveEstimateRequested = process.env.HALO_ONESHOT_ESTIMATE_LIVE === "1";
const liveSendRequested = process.env.HALO_ONESHOT_LIVE === "1";
const pollStatusEnabled = process.env.HALO_STEP20_STATUS_POLL !== "0";
const pollAttempts = Number(process.env.HALO_STEP20_STATUS_POLL_ATTEMPTS || process.env.HALO_STEP19_STATUS_POLL_ATTEMPTS || "4");
const pollIntervalMs = Number(
  process.env.HALO_STEP20_STATUS_POLL_INTERVAL_MS || process.env.HALO_STEP19_STATUS_POLL_INTERVAL_MS || "2500",
);
const balanceWaitMs = Number(process.env.HALO_STEP20_BALANCE_WAIT_MS || "6000");
const estimateScenario = process.env.HALO_ONESHOT_ESTIMATE_SCENARIO || "fee_and_grant";
const grantAmountUsdc =
  process.env.HALO_STEP20_GRANT_USDC ||
  process.env.HALO_STEP19_GRANT_USDC ||
  process.env.HALO_STEP18_GRANT_USDC ||
  process.env.HALO_STEP16_GRANT_USDC ||
  "25";
const grantAmountAtoms = parseDecimalToAtoms(grantAmountUsdc);
const requesterAddress = process.env.HALO_STEP20_REQUESTER_ADDRESS || process.env.HALO_STEP19_REQUESTER_ADDRESS || "";
const fallbackDryRunRequester = "0x4444444444444444444444444444444444444444";
const usdcToken = process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || BASE_SEPOLIA_USDC_ADDRESS;
let permissionGrant = null;
let donorAddress = "";
let feePaymentPlan = null;
let feePaymentIssue = null;
let estimateResult = null;
let estimateSummary = null;
let estimateClassification = null;
let sendResult = null;
let statusPoll = null;
let sendIssue = null;
let beforeBalances = null;
let afterBalances = null;
let sendAttempted = false;

console.log(`[SECURITY] HALO_ONESHOT_ESTIMATE_LIVE enabled=${liveEstimateRequested}.`);
console.log(`[SECURITY] HALO_ONESHOT_LIVE enabled=${liveSendRequested}.`);
console.log("[SECURITY] Step 20 will not print raw MetaMask context, 1Shot estimate context, taskId, tx hash, or wallet addresses.");
console.log(`[SECURITY] Step 20 requester configured=${Boolean(requesterAddress)}.`);
console.log("");

try {
  permissionGrant = parsePermissionGrantJson();
  donorAddress = normalizeAddress(permissionGrant?.from, "permissionGrant.from");
  console.log("[MetaMask] full grant donor address present=true.");
} catch (error) {
  sendIssue = `MetaMask grant donor address unavailable: ${error.message}`;
  console.log(`[NO-GO] ${sendIssue}.`);
}

if (liveEstimateRequested) {
  console.log("[1Shot] Discovering fee payment plan before Step 20 reconciliation.");
  try {
    feePaymentPlan = await fetchOneShotFeePaymentPlan();
    console.log(`[1Shot] fee collector hash=${hashJson(feePaymentPlan.feeCollector)}.`);
    console.log(`[1Shot] relayer target hash=${hashJson(feePaymentPlan.targetAddress)}.`);
    console.log(`[1Shot] planned fee payment=${feePaymentPlan.mockFeeAtoms} atoms.`);
    console.log("");
  } catch (error) {
    feePaymentIssue = `1Shot fee payment plan failed: ${error.message}`;
    console.log(`[NO-GO] ${feePaymentIssue}.`);
    console.log("");
  }
}

let balanceTargetSummary = null;
try {
  if (donorAddress && requesterAddress && feePaymentPlan?.feeCollector) {
    balanceTargetSummary = buildBalanceTargetSummary({
      donorAddress,
      requesterAddress,
      feeCollector: feePaymentPlan.feeCollector,
      usdcToken,
    });
    console.log("[RECON] Balance targets:");
    console.log(JSON.stringify(balanceTargetSummary, null, 2));
    console.log("");
  }
} catch (error) {
  sendIssue = sendIssue ?? `balance target summary failed: ${error.message}`;
  console.log(`[NO-GO] balance target summary failed: ${error.message}.`);
  console.log("");
}

const preflight = buildOneShotEstimatePreflight({
  feePaymentExecution: feePaymentPlan?.execution ?? null,
  feePaymentPlan: summarizeFeePaymentPlan(feePaymentPlan),
  estimateScenario,
  amount: grantAmountAtoms,
  liveSendEnabled: false,
  relayerTargetWallet: feePaymentPlan?.targetAddress ?? process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS,
  extraIssues: [
    ...(liveEstimateRequested ? [] : ["HALO_ONESHOT_ESTIMATE_LIVE=1 is required for Step 20 fresh estimate"]),
    ...(liveSendRequested && !requesterAddress
      ? ["HALO_STEP20_REQUESTER_ADDRESS or HALO_STEP19_REQUESTER_ADDRESS is required before live Step 20 retry"]
      : []),
    ...(feePaymentIssue ? [feePaymentIssue] : []),
    ...(sendIssue ? [sendIssue] : []),
  ],
  recipient: requesterAddress || fallbackDryRunRequester,
  memo: "Halo Step 20 relay reconciliation",
  requestId: 20,
});

console.log("[HALO] Step 20 fresh estimate preflight:");
for (const line of formatOneShotEstimatePreflightLogs(preflight)) {
  console.log(line);
}

if (preflight.readyForNetworkEstimate) {
  console.log("");
  console.log("[1Shot] Running fresh live estimate for Step 20. Live send remains separately gated.");
  estimateResult = await runOneShotEstimateAfterPreflight(preflight, {id: 20});
  estimateSummary = summarizeEstimateResult(estimateResult);
  estimateClassification = classifyOneShotEstimateResult(estimateResult);
  console.log("[1Shot] Fresh estimate result summary:");
  console.log(JSON.stringify({...estimateSummary, classification: estimateClassification}, null, 2));
} else {
  console.log("");
  console.log("[1Shot] Fresh estimate not called. Step 20 remains blocked.");
}

const rehearsal = buildOneShotLiveSendRehearsal({
  preflight,
  estimateResult,
  feePaymentPlan: summarizeFeePaymentPlan(feePaymentPlan),
  liveSendEnabled: liveSendRequested,
  requestId: 20,
});

console.log("");
console.log("[HALO] Step 20 live-send gate:");
for (const line of formatOneShotLiveSendRehearsalLogs(rehearsal)) {
  console.log(line);
}

const client = createBaseSepoliaClient();
if (client && donorAddress && requesterAddress && feePaymentPlan?.feeCollector) {
  console.log("");
  console.log("[RECON] Reading pre-send USDC balance snapshot.");
  beforeBalances = await readUsdcBalances({
    client,
    usdcToken,
    donorAddress,
    requesterAddress,
    feeCollector: feePaymentPlan.feeCollector,
  });
  console.log(`[RECON] pre-send balance snapshot hash=${hashJson(beforeBalances)}.`);
} else {
  console.log("");
  console.log("[RECON] Balance snapshot unavailable; set BASE_SEPOLIA_RPC_URL and full grant/requester details.");
}

if (rehearsal.readyForNetworkSend) {
  console.log("");
  console.log("[1Shot] Running live testnet send retry now.");
  sendAttempted = true;
  try {
    sendResult = await runOneShotLiveSendAfterRehearsal(rehearsal, {id: 20});
    const sendSummary = summarizeOneShotSendResult(sendResult);
    console.log("[1Shot] Live send retry result summary:");
    console.log(JSON.stringify(sendSummary, null, 2));
  } catch (error) {
    sendIssue = `1Shot live send retry failed: ${error.message}`;
    console.log(`[NO-GO] ${sendIssue}.`);
  }
} else {
  console.log("");
  console.log("[1Shot] Network send retry not called.");
}

if (client && beforeBalances && sendAttempted) {
  console.log("");
  console.log(`[RECON] Waiting ${balanceWaitMs}ms before post-send balance snapshot.`);
  if (balanceWaitMs > 0) {
    await sleep(balanceWaitMs);
  }
  afterBalances = await readUsdcBalances({
    client,
    usdcToken,
    donorAddress,
    requesterAddress,
    feeCollector: feePaymentPlan.feeCollector,
  });
  console.log(`[RECON] post-send balance snapshot hash=${hashJson(afterBalances)}.`);
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
      id: 20,
    });
  } catch (error) {
    sendIssue = `1Shot status poll failed: ${error.message}`;
    console.log(`[NO-GO] ${sendIssue}.`);
  }
} else if (taskId && !pollStatusEnabled) {
  console.log("");
  console.log("[1Shot] Status polling skipped by HALO_STEP20_STATUS_POLL=0.");
}

const confirmation = buildRelayConfirmationReport({
  step: 20,
  liveSendEnabled: liveSendRequested,
  sendResult,
  statusPoll,
  sendIssues: [...rehearsal.issues, ...(sendIssue ? [sendIssue] : [])],
});

const reconciliation = buildRelayReconciliationReport({
  liveSendEnabled: liveSendRequested,
  sendAttempted,
  taskIdPresent: confirmation.taskIdPresent,
  beforeBalances,
  afterBalances,
  grantAmountAtoms: grantAmountAtoms.toString(),
  feeAmountAtoms: feePaymentPlan?.mockFeeAtoms ?? null,
  issues: sendIssue && !confirmation.issues.includes(sendIssue) ? [sendIssue] : [],
});

console.log("");
console.log("[HALO] Step 20 relay confirmation:");
for (const line of formatRelayConfirmationLogs(confirmation)) {
  console.log(line);
}

console.log("");
console.log("[HALO] Step 20 reconciliation:");
for (const line of formatRelayReconciliationLogs(reconciliation)) {
  console.log(line);
}

console.log(
  JSON.stringify(
    {
      step: 20,
      confirmationStatus: confirmation.status,
      reconciliationStatus: reconciliation.status,
      chainId: rehearsal.chainId,
      endpoint: rehearsal.endpoint,
      liveEstimateEnabled: liveEstimateRequested,
      liveSendEnabled: liveSendRequested,
      estimateSucceeded: rehearsal.estimateSucceeded,
      requiredPaymentAmount: rehearsal.requiredPaymentAmount,
      plannedFeeAmount: rehearsal.plannedFeeAmount,
      feePaymentMatchesEstimate: rehearsal.feePaymentMatchesEstimate,
      requesterConfigured: Boolean(requesterAddress),
      donorFromGrantPresent: Boolean(donorAddress),
      readyForNetworkSend: rehearsal.readyForNetworkSend,
      sendAttempted,
      taskIdPresent: confirmation.taskIdPresent,
      taskIdHash: confirmation.taskIdHash,
      statusPollAttempts: confirmation.statusPollAttempts,
      grantStatus: confirmation.grantStatus,
      rawStatus: confirmation.rawStatus,
      txHashPresent: confirmation.txHashPresent,
      txHashHash: confirmation.txHashHash,
      balanceMovementMatches: reconciliation.balanceMovementMatches,
      balanceDeltas: reconciliation.deltas,
      estimateResultHash: estimateSummary?.resultHash ?? null,
      sendResultType: confirmation.sendResultType,
      sendResultHash: confirmation.sendResultHash,
      statusResultHash: confirmation.statusResultHash,
      confirmationIssues: confirmation.issues,
      reconciliationIssues: reconciliation.issues,
    },
    null,
    2,
  ),
);

console.log("");
console.log("[NEXT] Paid claim requires relayer status or signed webhook confirmation.");
