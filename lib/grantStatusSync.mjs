export const DEFAULT_GRANT_STATUS_SYNC_URL = "http://127.0.0.1:3000/api/grants/sync";
export const GRANT_STATUS_SYNC_URL_ENV_VAR = "HALO_GRANT_STATUS_SYNC_URL";
export const GRANT_STATUS_SYNC_TOKEN_ENV_VAR = "HALO_GRANT_STATUS_SYNC_TOKEN";

export async function syncGrantStatusEventToHalo({
  event,
  url = process.env.HALO_GRANT_STATUS_SYNC_URL || DEFAULT_GRANT_STATUS_SYNC_URL,
  token = process.env.HALO_GRANT_STATUS_SYNC_TOKEN || "",
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("grant status event is required before sync");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required before grant status sync");
  }

  const headers = {
    "content-type": "application/json",
  };
  if (token.trim()) {
    headers.authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
  });
  const body = await readJsonSafely(response);
  const ok = Boolean(response.ok && body?.ok !== false);

  return {
    attempted: true,
    ok,
    status: response.status,
    url,
    grantStatus: body?.grant?.status ?? null,
    eventCount: body?.grant?.eventCount ?? null,
    taskIdHash: body?.grant?.taskIdHash ?? null,
    issue: ok ? "" : String(body?.error ?? `grant status sync failed with HTTP ${response.status}`),
  };
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
