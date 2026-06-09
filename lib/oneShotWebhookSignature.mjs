import {createPublicKey, verify as verifySignature} from "node:crypto";

export const ONESHOT_WEBHOOK_PUBLIC_KEY_ENV_VAR = "ONESHOT_WEBHOOK_PUBLIC_KEY";
export const ONESHOT_WEBHOOK_SIGNATURE_REQUIRED_ENV_VAR = "ONESHOT_WEBHOOK_SIGNATURE_REQUIRED";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function canonicalizeOneShotWebhookPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("1Shot webhook payload must be an object");
  }

  const {signature: _signature, ...unsignedPayload} = payload;
  return stableJsonStringify(unsignedPayload);
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
  const message = Buffer.from(canonicalizeOneShotWebhookPayload(payload), "utf8");
  const verified = verifySignature(null, message, key, signatureBytes);

  if (!verified) {
    throw new Error("invalid 1Shot webhook signature");
  }

  return {
    verified: true,
    required,
    skipped: false,
    reason: "",
  };
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

  return Buffer.from(trimmed, "base64");
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
