import {createHash} from "node:crypto";

import {normalizeAmount} from "./hex.mjs";
import {buildSend7710Request, sendOneShot7710Transaction} from "./oneShot.mjs";
import {
  ESTIMATE_RESULT_CLASSIFICATION,
  LIVE_SEND_ENV_VAR,
  classifyOneShotEstimateResult,
} from "./oneShotEstimatePreflight.mjs";

export const LIVE_SEND_REHEARSAL_STATUS = Object.freeze({
  BLOCKED: "NO_GO_LIVE_SEND_BLOCKED",
  READY_DRY_RUN: "CONDITIONAL_GO_LIVE_SEND_DRY_RUN",
  READY_LIVE_SEND: "CONDITIONAL_GO_LIVE_SEND_READY",
});

export function buildOneShotLiveSendRehearsal({
  preflight,
  estimateResult,
  feePaymentPlan,
  liveSendEnabled = process.env.HALO_ONESHOT_LIVE === "1",
  requestId = 18,
} = {}) {
  const issues = [];
  const classification = classifyOneShotEstimateResult(estimateResult);
  const estimateContext = selectEstimateContext(estimateResult, preflight?.chainId);
  const requiredPaymentAmount = normalizeOptionalAmount(
    estimateResult?.requiredPaymentAmount,
    "estimateResult.requiredPaymentAmount",
  );
  const plannedFeeAmount = normalizeOptionalAmount(feePaymentPlan?.mockFeeAtoms, "feePaymentPlan.mockFeeAtoms");
  let sendParams = null;
  let sendRequest = null;

  if (!preflight?.readyForNetworkEstimate || !preflight.estimateReport) {
    issues.push("successful fresh estimate preflight is required before live send");
  }

  if (classification.classification !== ESTIMATE_RESULT_CLASSIFICATION.SUCCEEDED) {
    issues.push("1Shot estimate must return success=true before any send rehearsal");
  }

  if (!estimateContext) {
    issues.push("1Shot estimate context is required before send");
  }

  if (!feePaymentPlan) {
    issues.push("1Shot fee payment plan is required before send");
  }

  if (requiredPaymentAmount === null) {
    issues.push("1Shot requiredPaymentAmount is required before send");
  }

  if (plannedFeeAmount === null) {
    issues.push("planned 1Shot fee payment amount is required before send");
  }

  if (requiredPaymentAmount !== null && plannedFeeAmount !== null && requiredPaymentAmount !== plannedFeeAmount) {
    issues.push(
      `planned fee payment ${plannedFeeAmount.toString()} atoms must match estimate requiredPaymentAmount ${requiredPaymentAmount.toString()} atoms before send`,
    );
  }

  if (issues.length === 0) {
    sendParams = {
      ...preflight.estimateReport.params,
      context: estimateContext,
    };
    sendRequest = buildSend7710Request(sendParams, requestId);
  }

  const blocked = issues.length > 0;
  const status = blocked
    ? LIVE_SEND_REHEARSAL_STATUS.BLOCKED
    : liveSendEnabled
      ? LIVE_SEND_REHEARSAL_STATUS.READY_LIVE_SEND
      : LIVE_SEND_REHEARSAL_STATUS.READY_DRY_RUN;

  return {
    step: 18,
    title: "1Shot live send rehearsal",
    status,
    chainId: preflight?.chainId ?? null,
    endpoint: preflight?.endpoint ?? null,
    liveSendEnabled,
    estimateSucceeded: classification.classification === ESTIMATE_RESULT_CLASSIFICATION.SUCCEEDED,
    estimateClassification: classification,
    estimateContextPresent: Boolean(estimateContext),
    estimateContextHash: estimateContext ? hashString(estimateContext) : null,
    requiredPaymentAmount: requiredPaymentAmount?.toString() ?? null,
    plannedFeeAmount: plannedFeeAmount?.toString() ?? null,
    feePaymentMatchesEstimate:
      requiredPaymentAmount !== null && plannedFeeAmount !== null && requiredPaymentAmount === plannedFeeAmount,
    executionCount: preflight?.executionCount ?? 0,
    readyForNetworkSend: status === LIVE_SEND_REHEARSAL_STATUS.READY_LIVE_SEND,
    issues,
    sendParams,
    sendRequest,
    noGoFor: status === LIVE_SEND_REHEARSAL_STATUS.READY_LIVE_SEND
      ? ["mainnet_send", "uncapped_payout_claim"]
      : ["live_1shot_send", "live_payout_claim"],
  };
}

export async function runOneShotLiveSendAfterRehearsal(rehearsal, options = {}) {
  if (!rehearsal?.readyForNetworkSend || !rehearsal.sendParams) {
    throw new Error(`live send rehearsal is not ready: ${(rehearsal?.issues ?? []).join("; ") || "missing send params"}`);
  }

  return sendOneShot7710Transaction(rehearsal.sendParams, {
    endpoint: rehearsal.endpoint,
    id: options.id ?? 18,
    fetchImpl: options.fetchImpl,
    allowLive: rehearsal.liveSendEnabled,
  });
}

export function formatOneShotLiveSendRehearsalLogs(rehearsal) {
  const lines = [
    `[1Shot] endpoint=${rehearsal.endpoint ?? "unknown"}.`,
    `[1Shot] Base Sepolia chainId=${rehearsal.chainId ?? "unknown"}.`,
    `[1Shot] estimate success=${rehearsal.estimateSucceeded}.`,
    `[1Shot] estimate context present=${rehearsal.estimateContextPresent}.`,
    `[1Shot] required payment=${rehearsal.requiredPaymentAmount ?? "missing"} atoms.`,
    `[1Shot] planned fee payment=${rehearsal.plannedFeeAmount ?? "missing"} atoms.`,
    `[1Shot] fee payment matches estimate=${rehearsal.feePaymentMatchesEstimate}.`,
    `[SECURITY] ${LIVE_SEND_ENV_VAR} enabled=${rehearsal.liveSendEnabled}.`,
  ];

  if (rehearsal.estimateContextHash) {
    lines.push(`[1Shot] estimate context hash=${rehearsal.estimateContextHash}.`);
  }

  if (rehearsal.sendRequest) {
    lines.push(`[1Shot] send method=${rehearsal.sendRequest.method}.`);
  }

  if (rehearsal.issues.length > 0) {
    for (const issue of rehearsal.issues) {
      lines.push(`[NO-GO] ${issue}.`);
    }
  } else if (rehearsal.readyForNetworkSend) {
    lines.push("[CONDITIONAL GO] Live testnet send may run; mainnet remains blocked.");
  } else {
    lines.push("[CONDITIONAL GO] Live send params are ready; network send is still disabled.");
  }

  return lines;
}

export function selectEstimateContext(result, chainId) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return "";
  }

  if (typeof result.context === "string" && result.context.trim() !== "") {
    return result.context;
  }

  const key = chainId === undefined || chainId === null ? "" : String(chainId);
  const byChain = result.contextByChainId;
  if (key && byChain && typeof byChain === "object" && !Array.isArray(byChain)) {
    const value = byChain[key];
    return typeof value === "string" ? value : "";
  }

  return "";
}

function normalizeOptionalAmount(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return normalizeAmount(value, label);
}

function hashString(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
