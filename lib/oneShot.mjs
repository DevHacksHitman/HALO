import {normalizeAddress, normalizeAmount, normalizeHexData, toRpcQuantity} from "./hex.mjs";

export const ONESHOT_RELAYER_MAINNET_RPC_URL = "https://relayer.1shotapi.com/relayers";
export const ONESHOT_RELAYER_TESTNET_RPC_URL = "https://relayer.1shotapi.dev/relayers";
export const DEFAULT_ONESHOT_RELAYER_RPC_URL = ONESHOT_RELAYER_TESTNET_RPC_URL;
export const ONESHOT_RELAYER_RPC_URL =
  process.env.ONESHOT_RELAYER_RPC_URL ?? DEFAULT_ONESHOT_RELAYER_RPC_URL;
export const RELAYER_GET_CAPABILITIES = "relayer_getCapabilities";
export const RELAYER_GET_FEE_DATA = "relayer_getFeeData";
export const RELAYER_SEND_7710_TRANSACTION = "relayer_send7710Transaction";
export const RELAYER_ESTIMATE_7710_TRANSACTION = "relayer_estimate7710Transaction";
export const RELAYER_GET_STATUS = "relayer_getStatus";
export const ONESHOT_API_KEY_ENV_VAR = "ONESHOT_API_KEY";

const SUPPORTED_METHODS = new Set([
  RELAYER_GET_CAPABILITIES,
  RELAYER_GET_FEE_DATA,
  RELAYER_SEND_7710_TRANSACTION,
  RELAYER_ESTIMATE_7710_TRANSACTION,
  RELAYER_GET_STATUS,
]);

export function normalizeExecution(execution) {
  if (!execution || typeof execution !== "object") {
    throw new TypeError("execution must be an object");
  }

  return {
    target: normalizeAddress(execution.target, "execution.target"),
    value: toRpcQuantity(execution.value ?? 0, "execution.value"),
    data: normalizeHexData(execution.data, "execution.data"),
  };
}

export function normalizeCaveat(caveat, index = 0) {
  if (!caveat || typeof caveat !== "object") {
    throw new TypeError(`permissionContext.caveats[${index}] must be an object`);
  }

  return {
    enforcer: normalizeAddress(caveat.enforcer, `permissionContext.caveats[${index}].enforcer`),
    terms: normalizeHexData(caveat.terms ?? "0x", `permissionContext.caveats[${index}].terms`),
    args: normalizeHexData(caveat.args ?? "0x", `permissionContext.caveats[${index}].args`),
  };
}

export function normalizeDelegation(delegation, index = 0) {
  if (!delegation || typeof delegation !== "object") {
    throw new TypeError(`permissionContext[${index}] must be a delegation object`);
  }

  if (!Array.isArray(delegation.caveats)) {
    throw new TypeError(`permissionContext[${index}].caveats must be an array`);
  }

  return {
    delegate: normalizeAddress(delegation.delegate, `permissionContext[${index}].delegate`),
    delegator: normalizeAddress(delegation.delegator, `permissionContext[${index}].delegator`),
    authority: normalizeHexData(delegation.authority, `permissionContext[${index}].authority`),
    caveats: delegation.caveats.map((caveat, caveatIndex) => normalizeCaveat(caveat, caveatIndex)),
    salt: toRpcQuantity(delegation.salt, `permissionContext[${index}].salt`),
    signature: normalizeHexData(delegation.signature, `permissionContext[${index}].signature`),
  };
}

export function normalizePermissionContext(permissionContext) {
  if (typeof permissionContext === "string") {
    throw new TypeError(
      "permissionContext must be a decoded 7710 delegation array for 1Shot; decode MetaMask's hex context before sending",
    );
  }

  if (!Array.isArray(permissionContext) || permissionContext.length === 0) {
    throw new TypeError("permissionContext must contain at least one delegation");
  }

  return permissionContext.map((delegation, index) => normalizeDelegation(delegation, index));
}

export function buildOneShot7710Params({
  chainId,
  permissionContext,
  executions,
  destinationUrl,
  context,
  taskId,
  authorizationList,
}) {
  const normalizedChainId = normalizeAmount(chainId, "chainId");

  if (normalizedChainId === 0n) {
    throw new RangeError("chainId must be greater than zero");
  }

  if (!Array.isArray(executions) || executions.length === 0) {
    throw new TypeError("executions must contain at least one execution");
  }

  return {
    chainId: normalizedChainId.toString(),
    transactions: [
      {
        permissionContext: normalizePermissionContext(permissionContext),
        executions: executions.map(normalizeExecution),
      },
    ],
    ...(context ? {context} : {}),
    ...(taskId ? {taskId: normalizeHexData(taskId, "taskId")} : {}),
    ...(authorizationList ? {authorizationList} : {}),
    ...(destinationUrl ? {destinationUrl} : {}),
  };
}

export function buildOneShotJsonRpcRequest(method, params, id = 1) {
  if (!SUPPORTED_METHODS.has(method)) {
    throw new TypeError(`unsupported 1Shot method: ${method}`);
  }

  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

export function buildGetCapabilitiesRequest(chainIds, id = 1) {
  if (!Array.isArray(chainIds) || chainIds.length === 0) {
    throw new TypeError("chainIds must contain at least one chain id");
  }

  const params = chainIds.map((chainId) => normalizeAmount(chainId, "chainId").toString());
  return buildOneShotJsonRpcRequest(RELAYER_GET_CAPABILITIES, params, id);
}

export function buildGetFeeDataRequest({chainId, token}, id = 1) {
  return buildOneShotJsonRpcRequest(
    RELAYER_GET_FEE_DATA,
    {
      chainId: normalizeAmount(chainId, "chainId").toString(),
      token: normalizeAddress(token, "token"),
    },
    id,
  );
}

export function buildSend7710Request(params, id = 1) {
  return buildOneShotJsonRpcRequest(RELAYER_SEND_7710_TRANSACTION, params, id);
}

export function buildEstimate7710Request(params, id = 1) {
  return buildOneShotJsonRpcRequest(RELAYER_ESTIMATE_7710_TRANSACTION, params, id);
}

export function buildGetStatusRequest({taskId, logs = false}, id = 1) {
  return buildOneShotJsonRpcRequest(
    RELAYER_GET_STATUS,
    {
      id: normalizeHexData(taskId, "taskId"),
      logs: Boolean(logs),
    },
    id,
  );
}

export async function postOneShotJsonRpc({
  endpoint = ONESHOT_RELAYER_RPC_URL,
  request,
  fetchImpl = globalThis.fetch,
  apiKey = process.env.ONESHOT_API_KEY,
}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required");
  }

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: buildOneShotHeaders(apiKey),
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw new Error(`1Shot fetch failed for ${safeEndpointOrigin(endpoint)}: ${formatFetchError(error)}`);
  }

  if (!response.ok) {
    throw new Error(`1Shot HTTP ${response.status}${await safeResponsePreview(response)}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`1Shot ${payload.error.code}: ${payload.error.message}`);
  }

  return payload.result;
}

export function buildOneShotHeaders(apiKey = process.env.ONESHOT_API_KEY) {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? {Authorization: `Bearer ${apiKey}`} : {}),
  };
}

function formatFetchError(error) {
  const cause = error?.cause;
  const code = cause?.code ?? error?.code;
  const message = cause?.message ?? error?.message ?? String(error);
  return code ? `${code} ${message}` : message;
}

function safeEndpointOrigin(endpoint) {
  try {
    return new URL(endpoint).origin;
  } catch {
    return "invalid endpoint";
  }
}

async function safeResponsePreview(response) {
  if (typeof response.text !== "function") {
    return "";
  }

  try {
    const body = await response.text();
    return body ? `: ${body.slice(0, 240)}` : "";
  } catch {
    return "";
  }
}

export async function estimateOneShot7710Transaction(params, options = {}) {
  return postOneShotJsonRpc({
    ...options,
    request: buildEstimate7710Request(params, options.id ?? 1),
  });
}

export async function getOneShotCapabilities(chainIds, options = {}) {
  return postOneShotJsonRpc({
    ...options,
    request: buildGetCapabilitiesRequest(chainIds, options.id ?? 1),
  });
}

export async function getOneShotFeeData(params, options = {}) {
  return postOneShotJsonRpc({
    ...options,
    request: buildGetFeeDataRequest(params, options.id ?? 1),
  });
}

export async function sendOneShot7710Transaction(params, options = {}) {
  if (options.allowLive !== true && process.env.HALO_ONESHOT_LIVE !== "1") {
    throw new Error("live 1Shot send disabled; set HALO_ONESHOT_LIVE=1 or pass allowLive=true");
  }

  return postOneShotJsonRpc({
    ...options,
    request: buildSend7710Request(params, options.id ?? 1),
  });
}

export async function getOneShotStatus(params, options = {}) {
  return postOneShotJsonRpc({
    ...options,
    request: buildGetStatusRequest(params, options.id ?? 1),
  });
}
