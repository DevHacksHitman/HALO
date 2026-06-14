export const ONESHOT_WEBHOOK_URL_ENV_VAR = "HALO_ONESHOT_WEBHOOK_URL";
export const DEFAULT_DRY_RUN_ONESHOT_WEBHOOK_URL = "https://example.com/api/webhooks/1shot";

export function resolveOneShotWebhookUrl(destinationUrl, env = process.env) {
  const candidate = destinationUrl ?? env[ONESHOT_WEBHOOK_URL_ENV_VAR];

  if (typeof candidate === "string" && candidate.trim() !== "") {
    return candidate.trim();
  }

  return DEFAULT_DRY_RUN_ONESHOT_WEBHOOK_URL;
}

export function validateLiveOneShotWebhookUrl(destinationUrl, label = ONESHOT_WEBHOOK_URL_ENV_VAR) {
  const normalized = typeof destinationUrl === "string" ? destinationUrl.trim() : "";
  if (!normalized) {
    return `${label} is required before live 1Shot sends`;
  }

  let url;
  try {
    url = new URL(normalized);
  } catch (error) {
    return `${label} must be a valid HTTPS public callback URL: ${error.message}`;
  }

  if (url.protocol !== "https:") {
    return `${label} must use https:// before live 1Shot sends`;
  }

  const hostname = url.hostname.toLowerCase();
  if (isPlaceholderHostname(hostname)) {
    return `${label} must not use placeholder host ${hostname} before live 1Shot sends`;
  }

  if (isLocalHostname(hostname) || isPrivateIpv4Hostname(hostname)) {
    return `${label} must be a public HTTPS callback URL before live 1Shot sends`;
  }

  return "";
}

export function isLiveOneShotWebhookUrlReady(destinationUrl) {
  return validateLiveOneShotWebhookUrl(destinationUrl) === "";
}

function isPlaceholderHostname(hostname) {
  return (
    hostname === "example.com" ||
    hostname.endsWith(".example.com") ||
    hostname === "example.net" ||
    hostname.endsWith(".example.net") ||
    hostname === "example.org" ||
    hostname.endsWith(".example.org") ||
    hostname.endsWith(".example") ||
    hostname.endsWith(".invalid") ||
    hostname.endsWith(".test")
  );
}

function isLocalHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("127.") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isPrivateIpv4Hostname(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet, index) => !Number.isInteger(octet) || octet < 0 || octet > 255 || String(octet) !== parts[index])) {
    return false;
  }

  const [a, b] = octets;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}
