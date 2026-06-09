import {normalizeHexData} from "./hex.mjs";

export const GRANT_STATUS = Object.freeze({
  REQUESTED: "REQUESTED",
  VERIFYING: "VERIFYING",
  APPROVED: "APPROVED",
  RELAYING: "RELAYING",
  PAID: "PAID",
  FAILED: "FAILED",
});

const STATUS_RANK = {
  [GRANT_STATUS.REQUESTED]: 0,
  [GRANT_STATUS.VERIFYING]: 1,
  [GRANT_STATUS.APPROVED]: 2,
  [GRANT_STATUS.RELAYING]: 3,
  [GRANT_STATUS.PAID]: 4,
  [GRANT_STATUS.FAILED]: 5,
};

const ONESHOT_STATUS_MAP = new Map([
  ["created", GRANT_STATUS.RELAYING],
  ["queued", GRANT_STATUS.RELAYING],
  ["pending", GRANT_STATUS.RELAYING],
  ["estimated", GRANT_STATUS.RELAYING],
  ["submitted", GRANT_STATUS.RELAYING],
  ["relay_submitted", GRANT_STATUS.RELAYING],
  ["success", GRANT_STATUS.PAID],
  ["succeeded", GRANT_STATUS.PAID],
  ["confirmed", GRANT_STATUS.PAID],
  ["tx_success", GRANT_STATUS.PAID],
  ["failed", GRANT_STATUS.FAILED],
  ["failure", GRANT_STATUS.FAILED],
  ["error", GRANT_STATUS.FAILED],
  ["reverted", GRANT_STATUS.FAILED],
]);

export function parseOneShotWebhookPayload(payload, now = new Date()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("1Shot webhook payload must be an object");
  }

  const taskId = normalizeTaskId(
    payload.taskId ?? payload.id ?? payload.task?.id ?? payload.result?.id,
  );
  const rawStatus = requireNonEmptyString(
    payload.status ?? payload.event ?? payload.type ?? payload.result?.status,
    "webhook status",
  );
  const status = normalizeOneShotStatus(rawStatus);
  const txHash = normalizeOptionalTxHash(
    payload.txHash ?? payload.transactionHash ?? payload.hash ?? payload.result?.txHash,
  );
  const grantId = String(payload.grantId ?? payload.metadata?.grantId ?? taskId);
  const logs = Array.isArray(payload.logs)
    ? payload.logs.map((line) => String(line))
    : Array.isArray(payload.result?.logs)
      ? payload.result.logs.map((line) => String(line))
      : [];

  return {
    taskId,
    grantId,
    status,
    rawStatus: String(rawStatus),
    txHash,
    logs,
    receivedAt: normalizeTimestamp(payload.receivedAt, now),
    source: "1shot",
  };
}

export function reduceGrantEvent(currentGrant, event) {
  const normalizedEvent = normalizeGrantEvent(event);
  const current = currentGrant
    ? cloneGrant(currentGrant)
    : {
        grantId: normalizedEvent.grantId,
        taskId: normalizedEvent.taskId,
        status: GRANT_STATUS.REQUESTED,
        txHash: "",
        createdAt: normalizedEvent.receivedAt,
        updatedAt: normalizedEvent.receivedAt,
        events: [],
      };

  const nextStatus = chooseStatus(current.status, normalizedEvent.status);
  const nextTxHash = normalizedEvent.txHash || current.txHash || "";

  return {
    ...current,
    grantId: current.grantId || normalizedEvent.grantId,
    taskId: normalizedEvent.taskId,
    status: nextStatus,
    txHash: nextTxHash,
    updatedAt: normalizedEvent.receivedAt,
    events: [
      ...current.events,
      {
        status: normalizedEvent.status,
        rawStatus: normalizedEvent.rawStatus,
        txHash: normalizedEvent.txHash,
        logs: normalizedEvent.logs,
        receivedAt: normalizedEvent.receivedAt,
        source: normalizedEvent.source,
      },
    ],
  };
}

export function createGrantStatusStore() {
  const grantsByTaskId = new Map();

  return {
    record(payloadOrEvent) {
      const event =
        payloadOrEvent?.source === "1shot"
          ? normalizeGrantEvent(payloadOrEvent)
          : parseOneShotWebhookPayload(payloadOrEvent);
      const current = grantsByTaskId.get(event.taskId);
      const grant = reduceGrantEvent(current, event);
      grantsByTaskId.set(event.taskId, grant);
      return cloneGrant(grant);
    },
    get(taskId) {
      const grant = grantsByTaskId.get(normalizeTaskId(taskId));
      return grant ? cloneGrant(grant) : null;
    },
    list() {
      return [...grantsByTaskId.values()]
        .map(cloneGrant)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    reset() {
      grantsByTaskId.clear();
    },
  };
}

export const grantStatusStore = globalThis.__haloGrantStatusStore ?? createGrantStatusStore();
globalThis.__haloGrantStatusStore = grantStatusStore;

export function normalizeOneShotStatus(value) {
  const normalized = requireNonEmptyString(value, "webhook status").toLowerCase();
  const status = ONESHOT_STATUS_MAP.get(normalized);

  if (!status) {
    throw new TypeError(`unsupported 1Shot webhook status: ${value}`);
  }

  return status;
}

function normalizeGrantEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("grant event must be an object");
  }

  if (!Object.values(GRANT_STATUS).includes(event.status)) {
    throw new TypeError(`unsupported grant status: ${event.status}`);
  }

  return {
    taskId: normalizeTaskId(event.taskId),
    grantId: String(event.grantId ?? event.taskId),
    status: event.status,
    rawStatus: String(event.rawStatus ?? event.status),
    txHash: normalizeOptionalTxHash(event.txHash),
    logs: Array.isArray(event.logs) ? event.logs.map((line) => String(line)) : [],
    receivedAt: normalizeTimestamp(event.receivedAt, new Date()),
    source: event.source ?? "1shot",
  };
}

function chooseStatus(currentStatus, nextStatus) {
  if (currentStatus === GRANT_STATUS.FAILED) {
    return GRANT_STATUS.FAILED;
  }

  if (currentStatus === GRANT_STATUS.PAID && nextStatus !== GRANT_STATUS.FAILED) {
    return GRANT_STATUS.PAID;
  }

  return STATUS_RANK[nextStatus] >= STATUS_RANK[currentStatus] ? nextStatus : currentStatus;
}

function normalizeTaskId(value) {
  const taskId = requireNonEmptyString(value, "taskId");
  return /^0x[0-9a-fA-F]+$/.test(taskId) ? normalizeHexData(taskId, "taskId") : taskId;
}

function normalizeOptionalTxHash(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  return normalizeHexData(String(value), "txHash");
}

function normalizeTimestamp(value, fallbackDate) {
  if (value === undefined || value === null || value === "") {
    return fallbackDate.toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("receivedAt must be a valid timestamp");
  }

  return date.toISOString();
}

function cloneGrant(grant) {
  return {
    ...grant,
    events: grant.events.map((event) => ({
      ...event,
      logs: [...event.logs],
    })),
  };
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value.trim();
}
