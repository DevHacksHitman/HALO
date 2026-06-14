import {createHash} from "node:crypto";

import {RELAY_CONFIRMATION_STATUS} from "./oneShotRelayConfirmation.mjs";

export const STATUS_REPOLL_STATUS = Object.freeze({
  BLOCKED: "NO_GO_STATUS_REPOLL_BLOCKED",
  RELAYING: "CONDITIONAL_GO_STATUS_RELAYING",
  PAID: "CONDITIONAL_GO_STATUS_PAID",
  FAILED: "NO_GO_STATUS_FAILED",
  UNKNOWN: "CHECK_STATUS_UNKNOWN",
});

export function resolveStatusRePollTaskId({
  env = process.env,
  step = env.HALO_STATUS_REPOLL_STEP || "20",
  artifact = null,
} = {}) {
  const normalizedStep = String(step || "").trim();
  const candidates = [
    normalizedStep ? `HALO_STEP${normalizedStep}_TASK_ID` : "",
    "HALO_STEP20_TASK_ID",
    "HALO_ONESHOT_TASK_ID",
  ].filter(Boolean);

  for (const envVar of [...new Set(candidates)]) {
    const value = env[envVar];
    if (typeof value === "string" && value.trim() !== "") {
      return {
        taskId: value.trim(),
        source: envVar,
      };
    }
  }

  if (artifact && typeof artifact === "object" && !Array.isArray(artifact)) {
    const artifactTaskId = artifact.taskId ?? artifact.sendResult;
    if (typeof artifactTaskId === "string" && artifactTaskId.trim() !== "") {
      return {
        taskId: artifactTaskId.trim(),
        source: "local-artifact",
      };
    }
  }

  return {
    taskId: "",
    source: "",
  };
}

export function buildStatusRePollReport({
  step = 20,
  taskId = "",
  taskIdSource = "",
  endpoint = "",
  chainProfile = "",
  statusPoll = null,
  pollIssue = "",
} = {}) {
  const issues = [];
  const classification = statusPoll?.classification ?? null;

  if (!taskId) {
    issues.push(
      "HALO_STEP20_TASK_ID or HALO_ONESHOT_TASK_ID is required for status-only polling; do not resend only to recover status",
    );
  }
  if (pollIssue) {
    issues.push(pollIssue);
  }
  if (classification?.issues?.length > 0) {
    issues.push(...classification.issues);
  }

  const status = classifyStatus({taskId, classification, issues});

  return {
    step,
    status,
    chainProfile,
    endpoint,
    taskIdPresent: Boolean(taskId),
    taskIdSource,
    taskIdHash: taskId ? hashString(taskId) : null,
    pollAttempts: statusPoll?.attempts ?? 0,
    statusResultHash: statusPoll?.result ? hashJson(statusPoll.result) : null,
    grantStatus: classification?.grantStatus ?? null,
    rawStatus: classification?.rawStatus ?? null,
    txHashPresent: classification?.txHashPresent ?? false,
    txHashHash: classification?.txHashHash ?? null,
    issues,
    noGoFor: status === STATUS_REPOLL_STATUS.PAID ? [] : ["paid_claim_until_status_or_signed_webhook"],
  };
}

export function formatStatusRePollLogs(report) {
  const lines = [
    `[1Shot] status-only poll step=${report.step}.`,
    `[CHAIN] profile=${report.chainProfile || "unknown"}.`,
    `[1Shot] endpoint=${report.endpoint || "unknown"}.`,
    `[1Shot] taskId present=${report.taskIdPresent}.`,
  ];

  if (report.taskIdSource) {
    lines.push(`[1Shot] taskId source=${report.taskIdSource}.`);
  }
  if (report.taskIdHash) {
    lines.push(`[1Shot] taskId hash=${report.taskIdHash}.`);
  }
  if (report.pollAttempts > 0) {
    lines.push(`[1Shot] status poll attempts=${report.pollAttempts}.`);
    lines.push(`[STATUS] raw=${report.rawStatus ?? "unknown"}, normalized=${report.grantStatus ?? "unknown"}.`);
    lines.push(`[STATUS] tx hash present=${report.txHashPresent}.`);
  }
  if (report.txHashHash) {
    lines.push(`[STATUS] tx hash digest=${report.txHashHash}.`);
  }
  if (report.statusResultHash) {
    lines.push(`[STATUS] status result hash=${report.statusResultHash}.`);
  }

  for (const issue of report.issues) {
    lines.push(`[NO-GO] ${issue}.`);
  }

  if (report.status === STATUS_REPOLL_STATUS.PAID) {
    lines.push("[CONDITIONAL GO] relayer_getStatus returned terminal paid status. Paid wording may be used after cross-checking webhook/explorer evidence.");
  } else if (report.status === STATUS_REPOLL_STATUS.RELAYING) {
    lines.push("[CONDITIONAL GO] TaskId is still trackable, but no terminal paid status has been recorded.");
  } else if (!report.taskIdPresent) {
    lines.push("[NO-GO] No saved TaskId was found; do not generate a new TaskId unless you intentionally run a new relay send.");
  }

  return lines;
}

function classifyStatus({taskId, classification, issues}) {
  if (!taskId || issues.some((issue) => issue.includes("required for status-only polling"))) {
    return STATUS_REPOLL_STATUS.BLOCKED;
  }

  if (!classification || issues.length > 0) {
    return STATUS_REPOLL_STATUS.UNKNOWN;
  }

  if (classification.status === RELAY_CONFIRMATION_STATUS.STATUS_PAID) {
    return STATUS_REPOLL_STATUS.PAID;
  }
  if (classification.status === RELAY_CONFIRMATION_STATUS.STATUS_FAILED) {
    return STATUS_REPOLL_STATUS.FAILED;
  }
  if (classification.status === RELAY_CONFIRMATION_STATUS.STATUS_RELAYING) {
    return STATUS_REPOLL_STATUS.RELAYING;
  }

  return STATUS_REPOLL_STATUS.UNKNOWN;
}

function hashJson(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function hashString(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}
