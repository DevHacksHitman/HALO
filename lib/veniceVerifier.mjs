import {MAX_GRANT_AMOUNT_ATOMS, prepareVerifierX402Relay} from "./haloAgentBridge.mjs";
import {BASE_SEPOLIA_USDC_ADDRESS, parseDecimalToAtoms} from "./haloPermissions.mjs";
import {normalizeAddress, normalizeAmount} from "./hex.mjs";

export const VENICE_API_BASE_URL = process.env.VENICE_API_BASE_URL ?? "https://api.venice.ai/api/v1";
export const VENICE_CHAT_COMPLETIONS_URL = `${VENICE_API_BASE_URL}/chat/completions`;
export const VENICE_X402_TOP_UP_URL = `${VENICE_API_BASE_URL}/x402/top-up`;
export const DEFAULT_VENICE_VISION_MODEL = process.env.VENICE_VISION_MODEL ?? "mistral-31-24b";

const PAYMENT_REQUIRED_HEADER_NAMES = [
  "PAYMENT-REQUIRED",
  "payment-required",
  "X-402-Payment-Required",
  "x-402-payment-required",
];

export function buildReceiptVerificationPrompt({need, requestedAmountUsd}) {
  const normalizedNeed = requireNonEmptyString(need, "need");
  const normalizedAmount = requireNonEmptyString(String(requestedAmountUsd), "requestedAmountUsd");

  return [
    "Analyze this receipt or pharmacy notice for a mutual-aid request.",
    `Requester need: ${normalizedNeed}`,
    `Requested amount: ${normalizedAmount} USD`,
    "Return strict JSON only with this shape:",
    '{"valid": boolean, "extracted_amount": string, "category": string, "reason": string}',
    "Set valid=false if the image does not support the request.",
  ].join("\n");
}

export function buildReceiptVerificationMessages({need, requestedAmountUsd, receiptImageUrl}) {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: buildReceiptVerificationPrompt({need, requestedAmountUsd}),
        },
        {
          type: "image_url",
          image_url: {
            url: normalizeReceiptImageUrl(receiptImageUrl),
          },
        },
      ],
    },
  ];
}

export function buildReceiptVerificationRequest({
  xSignInWithX,
  need,
  requestedAmountUsd,
  receiptImageUrl,
  model = DEFAULT_VENICE_VISION_MODEL,
}) {
  const body = {
    model: requireNonEmptyString(model, "model"),
    messages: buildReceiptVerificationMessages({need, requestedAmountUsd, receiptImageUrl}),
    response_format: {type: "json_object"},
    temperature: 0,
  };

  return {
    url: VENICE_CHAT_COMPLETIONS_URL,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sign-In-With-X": requireNonEmptyString(xSignInWithX, "xSignInWithX"),
      },
      body: JSON.stringify(body),
    },
  };
}

export function buildVeniceTopUpProbeRequest() {
  return {
    url: VENICE_X402_TOP_UP_URL,
    init: {
      method: "POST",
      headers: {},
    },
  };
}

export function parseVeniceVerificationResult(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  const parsed = parseJsonObject(content);
  const valid = Boolean(parsed.valid);
  const amountValue = parsed.extracted_amount ?? parsed.extractedAmount;

  if (valid && amountValue === undefined) {
    throw new TypeError("Venice verification result is missing extracted_amount");
  }

  return {
    valid,
    extractedAmountAtoms: amountValue === undefined ? 0n : parseDecimalToAtoms(String(amountValue)),
    category: typeof parsed.category === "string" ? parsed.category : "unknown",
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    raw: parsed,
  };
}

export function evaluateReceiptVerification({
  result,
  requestedAmountUsd,
  maxGrantAmountAtoms = MAX_GRANT_AMOUNT_ATOMS,
}) {
  if (!result || typeof result !== "object") {
    throw new TypeError("result must be a Venice verification result");
  }

  const requestedAmountAtoms = parseDecimalToAtoms(String(requestedAmountUsd));
  const cap = normalizeAmount(maxGrantAmountAtoms, "maxGrantAmountAtoms");

  if (!result.valid) {
    return {
      approved: false,
      requestedAmountAtoms,
      extractedAmountAtoms: result.extractedAmountAtoms ?? 0n,
      reason: result.reason || "receipt did not validate",
    };
  }

  if (requestedAmountAtoms > cap) {
    return {
      approved: false,
      requestedAmountAtoms,
      extractedAmountAtoms: result.extractedAmountAtoms,
      reason: "requested amount exceeds grant cap",
    };
  }

  if (result.extractedAmountAtoms < requestedAmountAtoms) {
    return {
      approved: false,
      requestedAmountAtoms,
      extractedAmountAtoms: result.extractedAmountAtoms,
      reason: "receipt amount is below requested amount",
    };
  }

  return {
    approved: true,
    requestedAmountAtoms,
    extractedAmountAtoms: result.extractedAmountAtoms,
    reason: result.reason || "receipt supports requested need",
  };
}

export function parsePaymentRequiredHeader(headersOrValue) {
  const raw = typeof headersOrValue === "string" ? headersOrValue : readHeader(headersOrValue);

  if (!raw) {
    throw new TypeError("PAYMENT-REQUIRED header is missing");
  }

  return parseJsonObject(raw);
}

export function selectUsdcPaymentOffer(
  paymentRequired,
  {asset = BASE_SEPOLIA_USDC_ADDRESS, network = "base"} = {},
) {
  const offers = Array.isArray(paymentRequired?.accepts)
    ? paymentRequired.accepts
    : Array.isArray(paymentRequired?.accept)
      ? paymentRequired.accept
      : [];

  if (offers.length === 0) {
    throw new TypeError("x402 payment requirement has no accepted payment offers");
  }

  const normalizedAsset = normalizeAddress(asset, "asset");
  const offer = offers.find((candidate) => {
    if (!candidate?.asset || !candidate?.payTo) {
      return false;
    }

    const candidateNetwork = String(candidate.network ?? "").toLowerCase();
    const networkMatches = !network || candidateNetwork.includes(String(network).toLowerCase());
    return normalizeAddress(candidate.asset, "offer.asset") === normalizedAsset && networkMatches;
  });

  if (!offer) {
    throw new TypeError("x402 payment requirement has no supported USDC payment offer");
  }

  const rawAmount = offer.maxAmountRequired ?? offer.amount ?? offer.maxAmount;
  if (rawAmount === undefined) {
    throw new TypeError("x402 payment offer is missing maxAmountRequired");
  }

  return {
    scheme: offer.scheme ?? "exact",
    network: offer.network ?? network,
    asset: normalizedAsset,
    payTo: normalizeAddress(offer.payTo, "offer.payTo"),
    amountAtoms: normalizeAmount(rawAmount, "offer.maxAmountRequired"),
  };
}

export function prepareVeniceX402TopUpRelay({
  chainId,
  paymentRequired,
  permissionContext,
  destinationUrl,
  quoteContext,
  asset,
}) {
  const offer = selectUsdcPaymentOffer(paymentRequired, {asset});
  const relay = prepareVerifierX402Relay({
    chainId,
    usdcToken: offer.asset,
    venicePaymaster: offer.payTo,
    feeAmount: offer.amountAtoms,
    permissionContext,
    destinationUrl,
    quoteContext,
  });

  return {
    kind: "VENICE_X402_TOP_UP_PAYMENT",
    offer,
    relay,
    logs: [
      "[VENICE] x402 top-up requirement parsed.",
      `[x402] payTo=${offer.payTo}, asset=${offer.asset}, amount=${offer.amountAtoms.toString()} atoms.`,
      "[1Shot] Verifier relay draft prepared for Venice balance top-up.",
    ],
  };
}

function normalizeReceiptImageUrl(value) {
  const imageUrl = requireNonEmptyString(value, "receiptImageUrl");
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(imageUrl) && !/^https?:\/\//.test(imageUrl)) {
    throw new TypeError("receiptImageUrl must be a data:image base64 URL or https URL");
  }

  return imageUrl;
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  const text = requireNonEmptyString(value, "json").trim();
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new TypeError("json must contain an object");
  }

  return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
}

function readHeader(headers) {
  if (!headers) {
    return "";
  }

  if (typeof headers.get === "function") {
    for (const name of PAYMENT_REQUIRED_HEADER_NAMES) {
      const value = headers.get(name);
      if (value) {
        return value;
      }
    }
  }

  for (const name of PAYMENT_REQUIRED_HEADER_NAMES) {
    if (headers[name]) {
      return headers[name];
    }
  }

  const lowerEntries = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return lowerEntries["payment-required"] ?? lowerEntries["x-402-payment-required"] ?? "";
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value.trim();
}
