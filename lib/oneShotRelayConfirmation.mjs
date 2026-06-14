import {createHash} from "node:crypto";

import {GRANT_STATUS, parseOneShotWebhookPayload} from "./grantStatus.mjs";
import {getOneShotStatus} from "./oneShot.mjs";

export const RELAY_CONFIRMATION_STATUS = Object.freeze({
  BLOCKED: "NO_GO_RELAY_CONFIRMATION_BLOCKED",
  DRY_RUN_READY: "CONDITIONAL_GO_RELAY_STATUS_DRY_RUN",
  TASK_SUBMITTED: "CONDITIONAL_GO_TASK_SUBMITTED",
  STATUS_RELAYING: "CONDITIONAL_GO_RELAYING",
  STATUS_PAID: "CONDITIONAL_GO_STATUS_PAID",
  STATUS_FAILED: "NO_GO_RELAY_FAILED",
  STATUS_UNKNOWN: "CHECK_RELAY_STATUS_UNKNOWN",
});

export function extractOneShotTaskId(sendResult) {
  if (typeof sendResult === "string") {
    return sendResult.trim();
  }

  const taskId =
    sendResult?.taskId ??
    sendResult?.id ??
    sendResult?.task?.id ??
    sendResult?.result?.taskId ??
    sendResult?.result?.id ??
    "";

  return typeof taskId === "string" ? taskId.trim() : "";
}

export function summarizeOneShotSendResult(sendResult) {
  const taskId = extractOneShotTaskId(sendResult);

  return {
    resultType: Array.isArray(sendResult) ? "array" : sendResult === null ? "null" : typeof sendResult,
    resultKeys: objectKeys(sendResult),
    taskIdPresent: Boolean(taskId),
    taskIdHash: taskId ? hashString(taskId) : null,
    resultHash: hashJson(sendResult),
  };
}

export function buildOneShotStatusPayload({taskId, statusResult, grantId = "halo-step19-grant"} = {}) {
  if (!taskId) {
    throw new Error("taskId is required before relayer status can be normalized");
  }

  if (!statusResult || typeof statusResult !== "object" || Array.isArray(statusResult)) {
    throw new TypeError("1Shot status result must be an object");
  }

  const receipt = objectOrNull(statusResult.receipt) ?? objectOrNull(statusResult.result?.receipt);
  const task = objectOrNull(statusResult.task);
  const result = objectOrNull(statusResult.result);
  const rawStatus =
    statusResult.status ??
    statusResult.state ??
    statusResult.event ??
    statusResult.type ??
    task?.status ??
    result?.status ??
    "";

  if (!isStatusValue(rawStatus)) {
    throw new Error("1Shot status result did not include a status");
  }

  return {
    taskId,
    status: rawStatus,
    txHash:
      statusResult.txHash ??
      statusResult.transactionHash ??
      statusResult.hash ??
      receipt?.transactionHash ??
      receipt?.hash ??
      task?.txHash ??
      task?.transactionHash ??
      task?.hash ??
      result?.txHash ??
      result?.transactionHash ??
      result?.hash ??
      "",
    metadata: {grantId},
    logs: Array.isArray(statusResult.logs)
      ? statusResult.logs
      : Array.isArray(result?.logs)
        ? result.logs
        : Array.isArray(receipt?.logs)
          ? receipt.logs
          : [],
  };
}

export function classifyOneShotStatusResult({taskId, statusResult, grantId} = {}) {
  try {
    const payload = buildOneShotStatusPayload({taskId, statusResult, grantId});
    const event = parseOneShotWebhookPayload(payload);
    return {
      status:
        event.status === GRANT_STATUS.PAID
          ? RELAY_CONFIRMATION_STATUS.STATUS_PAID
          : event.status === GRANT_STATUS.FAILED
            ? RELAY_CONFIRMATION_STATUS.STATUS_FAILED
            : RELAY_CONFIRMATION_STATUS.STATUS_RELAYING,
      grantStatus: event.status,
      rawStatus: event.rawStatus,
      txHashPresent: Boolean(event.txHash),
      txHashHash: event.txHash ? hashString(event.txHash) : null,
      event,
      issues: [],
    };
  } catch (error) {
    return {
      status: RELAY_CONFIRMATION_STATUS.STATUS_UNKNOWN,
      grantStatus: null,
      rawStatus: null,
      txHashPresent: false,
      txHashHash: null,
      event: null,
      issues: [error.message],
    };
  }
}

export async function pollOneShotRelayStatus({
  taskId,
  endpoint,
  attempts = 3,
  intervalMs = 2000,
  logs = true,
  fetchImpl,
  id = 19,
} = {}) {
  if (!taskId) {
    throw new Error("taskId is required before polling 1Shot status");
  }

  const normalizedAttempts = parsePositiveInteger(attempts, "attempts");
  const normalizedIntervalMs = parseNonNegativeInteger(intervalMs, "intervalMs");
  let lastResult = null;

  for (let attempt = 1; attempt <= normalizedAttempts; attempt += 1) {
    lastResult = await getOneShotStatus(
      {taskId, logs},
      {
        endpoint,
        fetchImpl,
        id,
      },
    );

    const classification = classifyOneShotStatusResult({taskId, statusResult: lastResult});
    if (
      classification.status === RELAY_CONFIRMATION_STATUS.STATUS_PAID ||
      classification.status === RELAY_CONFIRMATION_STATUS.STATUS_FAILED
    ) {
      return {
        attempts: attempt,
        result: lastResult,
        classification,
      };
    }

    if (attempt < normalizedAttempts && normalizedIntervalMs > 0) {
      await delay(normalizedIntervalMs);
    }
  }

  return {
    attempts: normalizedAttempts,
    result: lastResult,
    classification: classifyOneShotStatusResult({taskId, statusResult: lastResult}),
  };
}

export function buildRelayConfirmationReport({
  step = 19,
  liveSendEnabled = false,
  sendResult = null,
  statusPoll = null,
  sendIssues = [],
} = {}) {
  const sendSummary = summarizeOneShotSendResult(sendResult);
  const taskId = extractOneShotTaskId(sendResult);
  const statusClassification = statusPoll?.classification ?? null;
  const issues = [...sendIssues, ...(statusClassification?.issues ?? [])];
  let status;

  if (issues.length > 0) {
    status = RELAY_CONFIRMATION_STATUS.BLOCKED;
  } else if (!liveSendEnabled) {
    status = RELAY_CONFIRMATION_STATUS.DRY_RUN_READY;
  } else if (!taskId) {
    status = RELAY_CONFIRMATION_STATUS.BLOCKED;
    issues.push("1Shot send result did not include a taskId; expected relayer_send7710Transaction to return a 0x-prefixed TaskId string");
  } else if (!statusPoll) {
    status = RELAY_CONFIRMATION_STATUS.TASK_SUBMITTED;
  } else {
    status = statusClassification.status;
  }

  return {
    step,
    status,
    liveSendEnabled,
    taskIdPresent: Boolean(taskId),
    taskIdHash: sendSummary.taskIdHash,
    sendResultType: sendSummary.resultType,
    sendResultHash: sendSummary.resultHash,
    sendResultKeys: sendSummary.resultKeys,
    statusPollAttempts: statusPoll?.attempts ?? 0,
    statusResultHash: statusPoll?.result ? hashJson(statusPoll.result) : null,
    grantStatus: statusClassification?.grantStatus ?? null,
    rawStatus: statusClassification?.rawStatus ?? null,
    txHashPresent: statusClassification?.txHashPresent ?? false,
    txHashHash: statusClassification?.txHashHash ?? null,
    issues,
    noGoFor: status === RELAY_CONFIRMATION_STATUS.STATUS_PAID ? [] : ["live_payout_claim"],
  };
}

export function formatRelayConfirmationLogs(report) {
  const lines = [
    `[1Shot] live send enabled=${report.liveSendEnabled}.`,
    `[1Shot] taskId present=${report.taskIdPresent}.`,
  ];

  if (report.taskIdHash) {
    lines.push(`[1Shot] taskId hash=${report.taskIdHash}.`);
  }

  if (report.statusPollAttempts > 0) {
    lines.push(`[1Shot] status poll attempts=${report.statusPollAttempts}.`);
    lines.push(`[STATUS] raw=${report.rawStatus ?? "unknown"}, normalized=${report.grantStatus ?? "unknown"}.`);
    lines.push(`[STATUS] tx hash present=${report.txHashPresent}.`);
    if (report.txHashHash) {
      lines.push(`[STATUS] tx hash digest=${report.txHashHash}.`);
    }
  }

  for (const issue of report.issues) {
    lines.push(`[NO-GO] ${issue}.`);
  }

  if (report.status === RELAY_CONFIRMATION_STATUS.STATUS_PAID) {
    lines.push("[CONDITIONAL GO] Relayer status reports paid; verify signed webhook before final demo claim.");
  } else if (report.status === RELAY_CONFIRMATION_STATUS.TASK_SUBMITTED) {
    lines.push("[CONDITIONAL GO] 1Shot task submitted; status/webhook confirmation is still pending.");
  } else if (report.status === RELAY_CONFIRMATION_STATUS.DRY_RUN_READY) {
    lines.push(`[CONDITIONAL GO] Step ${report.step ?? 19} send path is ready; live send is still disabled.`);
  }

  return lines;
}

function objectKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function isStatusValue(value) {
  return (
    (typeof value === "string" && value.trim() !== "") ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function hashJson(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function hashString(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new RangeError(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
