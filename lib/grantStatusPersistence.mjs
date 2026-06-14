import {createHash} from "node:crypto";

import {
  grantStatusStore,
  normalizeGrantEvent,
  parseOneShotWebhookPayload,
  reduceGrantEvent,
} from "./grantStatus.mjs";

export const UPSTASH_REDIS_REST_URL_ENV_VAR = "UPSTASH_REDIS_REST_URL";
export const UPSTASH_REDIS_REST_TOKEN_ENV_VAR = "UPSTASH_REDIS_REST_TOKEN";
export const GRANT_STATUS_REDIS_KEY_ENV_VAR = "HALO_GRANT_STATUS_REDIS_KEY";
export const DEFAULT_GRANT_STATUS_REDIS_KEY = "halo:grant-status-events";

export function normalizeGrantPayloadToEvent(payloadOrEvent, now = new Date()) {
  return payloadOrEvent?.source === "1shot"
    ? normalizeGrantEvent(payloadOrEvent)
    : parseOneShotWebhookPayload(payloadOrEvent, now);
}

export function getGrantStatusPersistenceInfo({env = process.env} = {}) {
  const config = readUpstashConfig(env);

  if (!config) {
    return {
      mode: "memory",
      persistent: false,
      configured: false,
      key: "",
      host: "",
    };
  }

  return {
    mode: "upstash-redis",
    persistent: true,
    configured: true,
    key: config.key,
    host: config.host,
  };
}

export async function recordGrantStatus(payloadOrEvent, options = {}) {
  const {
    env = process.env,
    fetchImpl = globalThis.fetch,
    memoryStore = grantStatusStore,
    now = new Date(),
  } = options;
  const event = normalizeGrantPayloadToEvent(payloadOrEvent, now);
  const config = readUpstashConfig(env);

  if (!config) {
    return memoryStore.record(event);
  }

  await executeUpstashRedisCommand(["RPUSH", config.key, JSON.stringify(event)], {
    config,
    fetchImpl,
  });
  const grants = await listGrantStatuses({env, fetchImpl, memoryStore});
  const grant = grants.find((candidate) => candidate.taskId === event.taskId);
  if (!grant) {
    throw new Error("persisted grant event could not be replayed");
  }

  return grant;
}

export async function listGrantStatuses(options = {}) {
  const {env = process.env, fetchImpl = globalThis.fetch, memoryStore = grantStatusStore} = options;
  const config = readUpstashConfig(env);

  if (!config) {
    return memoryStore.list();
  }

  const rawEvents = await executeUpstashRedisCommand(["LRANGE", config.key, "0", "-1"], {
    config,
    fetchImpl,
  });
  const events = parseStoredGrantEvents(rawEvents);

  return reduceGrantEvents(events);
}

export function reduceGrantEvents(events) {
  const grantsByTaskId = new Map();

  for (const event of events) {
    const normalized = normalizeGrantEvent(event);
    const current = grantsByTaskId.get(normalized.taskId) ?? null;
    grantsByTaskId.set(normalized.taskId, reduceGrantEvent(current, normalized));
  }

  return [...grantsByTaskId.values()]
    .map((grant) => ({
      ...grant,
      events: grant.events.map((event) => ({
        ...event,
        logs: [...event.logs],
      })),
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function hashGrantStatusValue(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

async function executeUpstashRedisCommand(command, {config, fetchImpl}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required for Upstash grant persistence");
  }

  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const body = await readJsonSafely(response);

  if (!response?.ok || body?.error) {
    const message = body?.error
      ? String(body.error)
      : `Upstash Redis command failed with HTTP ${response?.status ?? "unknown"}`;
    throw new Error(message);
  }

  return body?.result;
}

function parseStoredGrantEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) {
    return [];
  }

  return rawEvents.map((rawEvent, index) => {
    if (typeof rawEvent === "string") {
      try {
        return JSON.parse(rawEvent);
      } catch (error) {
        throw new Error(`stored grant event ${index} is not valid JSON`);
      }
    }

    return rawEvent;
  });
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readUpstashConfig(env) {
  const url = env?.[UPSTASH_REDIS_REST_URL_ENV_VAR]?.trim();
  const token = env?.[UPSTASH_REDIS_REST_TOKEN_ENV_VAR]?.trim();
  if (!url || !token) {
    return null;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new TypeError(`${UPSTASH_REDIS_REST_URL_ENV_VAR} must be a valid URL`);
  }

  return {
    url: parsedUrl.toString().replace(/\/$/, ""),
    host: parsedUrl.host,
    token,
    key: env?.[GRANT_STATUS_REDIS_KEY_ENV_VAR]?.trim() || DEFAULT_GRANT_STATUS_REDIS_KEY,
  };
}
