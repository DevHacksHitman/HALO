import {createPublicKey, verify as verifySignature} from "node:crypto";

export const ONESHOT_WEBHOOK_PUBLIC_KEY_ENV_VAR = "ONESHOT_WEBHOOK_PUBLIC_KEY";
export const ONESHOT_WEBHOOK_SIGNATURE_REQUIRED_ENV_VAR = "ONESHOT_WEBHOOK_SIGNATURE_REQUIRED";
export const ONESHOT_WEBHOOK_JWKS_URL_ENV_VAR = "ONESHOT_WEBHOOK_JWKS_URL";
export const DEFAULT_ONESHOT_WEBHOOK_JWKS_URL = "https://relayer.1shotapi.com/.well-known/jwks.json";
export const TESTNET_ONESHOT_WEBHOOK_JWKS_URL = "https://relayer.1shotapi.dev/.well-known/jwks.json";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function canonicalizeOneShotWebhookPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("1Shot webhook payload must be an object");
  }

  const {signature: _signature, ...unsignedPayload} = payload;
  return stableJsonStringify(unsignedPayload);
}

export function buildOneShotWebhookVerificationMessages(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("1Shot webhook payload must be an object");
  }

  const {signature: _signature, ...unsignedPayload} = payload;
  const {keyId: _keyId, kid: _kid, ...withoutSignatureAndKeyId} = unsignedPayload;
  const messages = [
    {
      mode: "stable_without_signature",
      message: stableJsonStringify(unsignedPayload),
    },
    {
      mode: "json_without_signature",
      message: JSON.stringify(unsignedPayload),
    },
  ];

  if ("keyId" in unsignedPayload || "kid" in unsignedPayload) {
    messages.push({
      mode: "stable_without_signature_and_key_id",
      message: stableJsonStringify(withoutSignatureAndKeyId),
    });
    messages.push({
      mode: "json_without_signature_and_key_id",
      message: JSON.stringify(withoutSignatureAndKeyId),
    });
  }

  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    messages.push({
      mode: "stable_data_only",
      message: stableJsonStringify(payload.data),
    });
    messages.push({
      mode: "json_data_only",
      message: JSON.stringify(payload.data),
    });
  }

  return dedupeMessages(messages);
}

export function verifyOneShotWebhookSignature(
  payload,
  {
    publicKey = process.env[ONESHOT_WEBHOOK_PUBLIC_KEY_ENV_VAR],
    signature = payload?.signature,
    required = process.env[ONESHOT_WEBHOOK_SIGNATURE_REQUIRED_ENV_VAR] === "1",
  } = {},
) {
  if (!publicKey) {
    if (required) {
      throw new Error(`${ONESHOT_WEBHOOK_PUBLIC_KEY_ENV_VAR} is required for signed 1Shot webhooks`);
    }

    return {
      verified: false,
      required: false,
      skipped: true,
      reason: "public key not configured",
    };
  }

  const key = createEd25519PublicKey(publicKey);
  const signatureBytes = decodeSignatureBytes(signature);
  const verification = verifyOneShotWebhookMessages({payload, key, signatureBytes});

  if (!verification.verified) {
    throw new Error("invalid 1Shot webhook signature");
  }

  return {
    verified: true,
    required,
    skipped: false,
    reason: "",
    mode: verification.mode,
  };
}

export async function verifyOneShotWebhookSignatureWithJwks(
  payload,
  {
    publicKey = process.env[ONESHOT_WEBHOOK_PUBLIC_KEY_ENV_VAR],
    signature = payload?.signature,
    required = process.env[ONESHOT_WEBHOOK_SIGNATURE_REQUIRED_ENV_VAR] === "1",
    jwksUrl = resolveOneShotWebhookJwksUrl(),
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (publicKey) {
    return verifyOneShotWebhookSignature(payload, {publicKey, signature, required});
  }

  const keyId = getWebhookKeyId(payload);
  if (!keyId) {
    return verifyOneShotWebhookSignature(payload, {publicKey: "", signature, required});
  }

  const jwk = await fetchOneShotWebhookJwk({keyId, jwksUrl, fetchImpl});
  const resolvedPublicKey = publicKeyFromEd25519Jwk(jwk);
  return {
    ...verifyOneShotWebhookSignature(payload, {
      publicKey: resolvedPublicKey,
      signature,
      required,
    }),
    keyId,
    jwksUrl,
  };
}

export function resolveOneShotWebhookJwksUrl({
  env = process.env,
  chainProfile = env.HALO_CHAIN_PROFILE,
} = {}) {
  const configured = env[ONESHOT_WEBHOOK_JWKS_URL_ENV_VAR];
  if (typeof configured === "string" && configured.trim() !== "") {
    return configured.trim();
  }

  const normalizedProfile = String(chainProfile || "").trim().toLowerCase();
  return normalizedProfile === "base-mainnet" || normalizedProfile === "mainnet" || normalizedProfile === "base"
    ? DEFAULT_ONESHOT_WEBHOOK_JWKS_URL
    : TESTNET_ONESHOT_WEBHOOK_JWKS_URL;
}

export function createEd25519PublicKey(publicKey) {
  const trimmed = requireNonEmptyString(publicKey, "1Shot webhook public key");

  if (trimmed.includes("BEGIN PUBLIC KEY")) {
    return createPublicKey(trimmed);
  }

  const rawPublicKey = decodeBytes(trimmed, "1Shot webhook public key");
  if (rawPublicKey.length !== 32) {
    throw new RangeError("1Shot webhook public key must be a 32-byte Ed25519 public key");
  }

  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, rawPublicKey]),
    format: "der",
    type: "spki",
  });
}

export async function fetchOneShotWebhookJwk({keyId, jwksUrl = DEFAULT_ONESHOT_WEBHOOK_JWKS_URL, fetchImpl = globalThis.fetch} = {}) {
  const normalizedKeyId = requireNonEmptyString(keyId, "1Shot webhook keyId");
  const normalizedJwksUrl = requireNonEmptyString(jwksUrl, "1Shot webhook JWKS URL");
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required for 1Shot webhook JWKS lookup");
  }

  const response = await fetchImpl(normalizedJwksUrl, {method: "GET"});
  if (!response?.ok) {
    throw new Error(`1Shot webhook JWKS fetch failed${response?.status ? `: HTTP ${response.status}` : ""}`);
  }

  const jwks = await response.json();
  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const jwk = keys.find((candidate) => candidate?.kid === normalizedKeyId);
  if (!jwk) {
    throw new Error(`1Shot webhook JWKS did not include keyId ${normalizedKeyId}`);
  }

  return jwk;
}

export function publicKeyFromEd25519Jwk(jwk) {
  if (!jwk || typeof jwk !== "object" || Array.isArray(jwk)) {
    throw new TypeError("1Shot webhook JWK must be an object");
  }

  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519") {
    throw new TypeError("1Shot webhook JWK must be an Ed25519 OKP key");
  }

  return decodeBase64Url(jwk.x, "1Shot webhook JWK x").toString("base64");
}

function verifyOneShotWebhookMessages({payload, key, signatureBytes}) {
  for (const {mode, message} of buildOneShotWebhookVerificationMessages(payload)) {
    const verified = verifySignature(null, Buffer.from(message, "utf8"), key, signatureBytes);
    if (verified) {
      return {
        verified: true,
        mode,
      };
    }
  }

  return {
    verified: false,
    mode: "",
  };
}

function getWebhookKeyId(payload) {
  const keyId = payload?.keyId ?? payload?.kid;
  return typeof keyId === "string" && keyId.trim() !== "" ? keyId.trim() : "";
}

function decodeSignatureBytes(signature) {
  const signatureBytes = decodeBytes(signature, "1Shot webhook signature");
  if (signatureBytes.length !== 64) {
    throw new RangeError("1Shot webhook signature must be a 64-byte Ed25519 signature");
  }

  return signatureBytes;
}

function decodeBytes(value, label) {
  const trimmed = requireNonEmptyString(value, label);

  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    const hex = trimmed.slice(2);
    if (hex.length % 2 !== 0) {
      throw new TypeError(`${label} hex must have an even number of digits`);
    }
    return Buffer.from(hex, "hex");
  }

  return decodeBase64OrBase64Url(trimmed);
}

function decodeBase64Url(value, label) {
  const trimmed = requireNonEmptyString(value, label);
  return decodeBase64OrBase64Url(trimmed);
}

function decodeBase64OrBase64Url(value) {
  const trimmed = String(value).trim();
  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function dedupeMessages(messages) {
  const seen = new Set();
  return messages.filter(({message}) => {
    if (seen.has(message)) {
      return false;
    }
    seen.add(message);
    return true;
  });
}

function stableJsonStringify(value) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(",")}]`;
  }

  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("JSON numbers must be finite");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  throw new TypeError(`unsupported JSON value type: ${typeof value}`);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value.trim();
}
