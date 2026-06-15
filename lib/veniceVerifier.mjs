import {createHash} from "node:crypto";

import {MAX_GRANT_AMOUNT_ATOMS, prepareVerifierX402Relay} from "./haloAgentBridge.mjs";
import {BASE_SEPOLIA_USDC_ADDRESS, parseDecimalToAtoms} from "./haloPermissions.mjs";
import {normalizeAddress, normalizeAmount} from "./hex.mjs";
import {decimalUsdcToAtoms, getHaloChainProfile} from "./chainProfiles.mjs";

export const VENICE_API_BASE_URL = process.env.VENICE_API_BASE_URL ?? "https://api.venice.ai/api/v1";
export const VENICE_CHAT_COMPLETIONS_URL = `${VENICE_API_BASE_URL}/chat/completions`;
export const VENICE_X402_TOP_UP_URL = `${VENICE_API_BASE_URL}/x402/top-up`;
export const DEFAULT_VENICE_VISION_MODEL = process.env.VENICE_VISION_MODEL ?? "google-gemma-3-27b-it";
export const VENICE_X402_CHAIN_ID = 8453;
export const VENICE_X402_NETWORK = "eip155:8453";
export const VENICE_X402_BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const HALO_BASE_SEPOLIA_RELAY_PROOF_CHAIN_ID = 84532;
export const DEFAULT_MAINNET_MAX_VENICE_TOPUP_USDC = "5";
export const DEFAULT_MAINNET_MAX_X402_PER_REQUEST_USDC = "1";

export const VENICE_X402_SHADOW_STATUS = Object.freeze({
  BLOCKED: "NO_GO_X402_SHADOW_BLOCKED",
  READY: "CONDITIONAL_GO_X402_SHADOW_READY",
});

export const VENICE_X402_LIVE_STATUS = Object.freeze({
  BLOCKED: "NO_GO_X402_LIVE_BLOCKED",
  READY: "CONDITIONAL_GO_X402_LIVE_READY",
});

export const VENICE_LIVE_VERIFIER_STATUS = Object.freeze({
  BLOCKED: "NO_GO_VENICE_LIVE_VERIFIER_BLOCKED",
  READY: "CONDITIONAL_GO_VENICE_LIVE_VERIFIER_READY",
});

export const VENICE_X402_REQUIRED_PACKAGES = Object.freeze([
  "@x402/core",
  "@x402/fetch",
  "@metamask/x402",
]);

const PAYMENT_REQUIRED_HEADER_NAMES = [
  "PAYMENT-REQUIRED",
  "payment-required",
  "X-402-Payment-Required",
  "x-402-payment-required",
];

export function buildReceiptVerificationPrompt({need, requestedAmountUsd, receiptEvidence = null}) {
  const normalizedNeed = requireNonEmptyString(need, "need");
  const normalizedAmount = requireNonEmptyString(String(requestedAmountUsd), "requestedAmountUsd");
  const receiptEvidenceLines = formatReceiptEvidenceLines(receiptEvidence);

  return [
    "Analyze this receipt or pharmacy notice for a mutual-aid request.",
    `Requester need: ${normalizedNeed}`,
    `Requested amount: ${normalizedAmount} USD`,
    ...receiptEvidenceLines,
    "Return strict JSON only with this shape:",
    '{"valid": boolean, "extracted_amount": string, "category": string, "reason": string, "grant_message": string}',
    "Set valid=false if the receipt evidence does not support the request.",
    "If OCR is uncertain, compare the requester need against the provided local receipt fields instead of treating the demo receipt as blank.",
    "If valid=true, grant_message should be one warm sentence for the requester.",
  ].join("\n");
}

export function buildReceiptVerificationMessages({need, requestedAmountUsd, receiptImageUrl, receiptEvidence = null}) {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: buildReceiptVerificationPrompt({need, requestedAmountUsd, receiptEvidence}),
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
  receiptEvidence = null,
  model = DEFAULT_VENICE_VISION_MODEL,
}) {
  const body = {
    model: requireNonEmptyString(model, "model"),
    messages: buildReceiptVerificationMessages({need, requestedAmountUsd, receiptImageUrl, receiptEvidence}),
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

export function buildReceiptVerificationBearerRequest({
  apiKey = process.env.VENICE_API_KEY,
  need,
  requestedAmountUsd,
  receiptImageUrl,
  receiptEvidence = null,
  model = DEFAULT_VENICE_VISION_MODEL,
}) {
  const body = buildReceiptVerificationBody({need, requestedAmountUsd, receiptImageUrl, receiptEvidence, model});

  return {
    url: VENICE_CHAT_COMPLETIONS_URL,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireNonEmptyString(apiKey, "apiKey")}`,
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
  const grantMessage = parsed.grant_message ?? parsed.grantMessage;

  if (valid && amountValue === undefined) {
    throw new TypeError("Venice verification result is missing extracted_amount");
  }

  return {
    valid,
    extractedAmountAtoms: amountValue === undefined ? 0n : parseDecimalToAtoms(normalizeVeniceDecimalString(amountValue)),
    category: typeof parsed.category === "string" ? parsed.category : "unknown",
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    grantMessage: typeof grantMessage === "string" ? grantMessage : "",
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

export function buildVeniceLiveVerifierReport({
  apiKeyPresent = false,
  model = DEFAULT_VENICE_VISION_MODEL,
  receiptHash = "",
  responseStatus = null,
  result = null,
  decision = null,
  error = "",
} = {}) {
  const issues = [];

  if (!apiKeyPresent) {
    issues.push("VENICE_API_KEY is required for live Venice verifier proof");
  }
  if (!receiptHash) {
    issues.push("synthetic receipt hash is required");
  }
  if (responseStatus === null || responseStatus === undefined) {
    issues.push("Venice response status is required");
  } else if (Number(responseStatus) < 200 || Number(responseStatus) >= 300) {
    issues.push(`Venice response status ${responseStatus} is not successful`);
  }
  if (!result) {
    issues.push("parsed Venice verification result is required");
  }
  if (!decision) {
    issues.push("Halo grant decision is required");
  }
  if (error) {
    issues.push(error);
  }

  const status = issues.length > 0 ? VENICE_LIVE_VERIFIER_STATUS.BLOCKED : VENICE_LIVE_VERIFIER_STATUS.READY;

  return {
    step: 21,
    title: "Venice live verifier proof",
    status,
    liveVenice: true,
    x402Settlement: false,
    oneShotSend: false,
    model: requireNonEmptyString(model, "model"),
    apiKeyPresent: Boolean(apiKeyPresent),
    receiptHash,
    responseStatus,
    parsedResult: result
      ? {
          valid: Boolean(result.valid),
          extractedAmountAtoms: (result.extractedAmountAtoms ?? 0n).toString(),
          category: result.category ?? "unknown",
          reason: result.reason ?? "",
          grantMessage: result.grantMessage ?? "",
        }
      : null,
    decision: decision
      ? {
          approved: Boolean(decision.approved),
          requestedAmountAtoms: (decision.requestedAmountAtoms ?? 0n).toString(),
          extractedAmountAtoms: (decision.extractedAmountAtoms ?? 0n).toString(),
          reason: decision.reason ?? "",
        }
      : null,
    requesterMessage: result?.grantMessage || decision?.reason || "",
    issues,
    noGoFor: [
      "x402_settlement_claim",
      "paid_grant_claim",
      "a2a_claim",
      "mainnet_claim",
    ],
  };
}

export function parsePaymentRequiredHeader(headersOrValue) {
  const raw = typeof headersOrValue === "string" ? headersOrValue : readHeader(headersOrValue);

  if (!raw) {
    throw new TypeError("PAYMENT-REQUIRED header is missing");
  }

  return parsePaymentRequiredValue(raw);
}

export function extractVeniceX402PaymentRequirement({headers, body} = {}) {
  const header = readHeader(headers);
  if (header) {
    return {
      paymentRequired: parsePaymentRequiredHeader(header),
      source: "PAYMENT-REQUIRED header",
      headerPresent: true,
    };
  }

  const bodyCandidate = getPaymentRequiredBodyCandidate(body);
  if (bodyCandidate) {
    return {
      paymentRequired: bodyCandidate,
      source: "response body",
      headerPresent: false,
    };
  }

  throw new TypeError("Venice x402 payment requirement is missing from PAYMENT-REQUIRED header and response body");
}

export function selectUsdcPaymentOffer(
  paymentRequired,
  {asset = VENICE_X402_BASE_USDC_ADDRESS, network = VENICE_X402_NETWORK} = {},
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
    const networkMatches = paymentNetworkMatches(candidateNetwork, network);
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

export function buildVeniceX402ShadowProbeReport({
  step = 7,
  responseStatus = 402,
  paymentRequired,
  paymentRequiredHeader,
  body = null,
  currentRelayChainId = HALO_BASE_SEPOLIA_RELAY_PROOF_CHAIN_ID,
  currentRelayAsset = BASE_SEPOLIA_USDC_ADDRESS,
  settlementEnabled = false,
} = {}) {
  const issues = [];
  let parsedPaymentRequired = paymentRequired ?? null;
  let offer = null;

  if (!parsedPaymentRequired && paymentRequiredHeader) {
    try {
      parsedPaymentRequired = parsePaymentRequiredHeader(paymentRequiredHeader);
    } catch (error) {
      issues.push(`Venice PAYMENT-REQUIRED header could not be parsed: ${error.message}`);
    }
  }

  if (responseStatus !== 402) {
    issues.push("Venice x402 shadow probe expects an HTTP 402 payment requirement response");
  }

  if (!parsedPaymentRequired) {
    issues.push("Venice x402 payment requirement is required before settlement design");
  } else {
    try {
      offer = selectUsdcPaymentOffer(parsedPaymentRequired, {
        asset: VENICE_X402_BASE_USDC_ADDRESS,
        network: VENICE_X402_NETWORK,
      });
    } catch (error) {
      issues.push(error.message);
    }
  }

  if (settlementEnabled) {
    issues.push("Venice x402 shadow probe must not submit X-402-Payment settlement");
  }

  const normalizedCurrentRelayAsset = normalizeAddress(currentRelayAsset, "currentRelayAsset");
  const relayProofChainId = normalizeAmount(currentRelayChainId, "currentRelayChainId").toString();
  const veniceAsset = normalizeAddress(VENICE_X402_BASE_USDC_ADDRESS, "VENICE_X402_BASE_USDC_ADDRESS");
  const relayProofMatchesVeniceSettlement =
    relayProofChainId === String(VENICE_X402_CHAIN_ID) && normalizedCurrentRelayAsset === veniceAsset;
  const status = issues.length > 0 ? VENICE_X402_SHADOW_STATUS.BLOCKED : VENICE_X402_SHADOW_STATUS.READY;

  return {
    step,
    title: "Venice x402 shadow probe",
    status,
    shadowMode: true,
    paymentRequirementCaptured: Boolean(parsedPaymentRequired),
    settlementReady: false,
    liveSettlementEnabled: false,
    responseStatus,
    veniceSettlement: {
      chainId: String(VENICE_X402_CHAIN_ID),
      network: VENICE_X402_NETWORK,
      asset: veniceAsset,
      minimumTopUpUsd: body?.minimumTopUpUsd ?? body?.topUpInstructions?.minimumAmountUsd ?? null,
    },
    selectedOffer: offer
      ? {
          scheme: offer.scheme,
          network: offer.network,
          asset: offer.asset,
          payTo: offer.payTo,
          amountAtoms: offer.amountAtoms.toString(),
        }
      : null,
    currentRelayProof: {
      chainId: relayProofChainId,
      asset: normalizedCurrentRelayAsset,
    },
    relayProofMatchesVeniceSettlement,
    issues,
    noGoFor: [
      "live_x402_settlement",
      "base_sepolia_venice_x402_settlement",
      "uncapped_venice_spend",
    ],
  };
}

export function buildVeniceX402ShadowPublicSummary({report, packageReport} = {}) {
  if (!report || typeof report !== "object") {
    throw new TypeError("report must be a Venice x402 shadow report");
  }

  return {
    step: 22,
    title: "Venice x402 shadow probe",
    status: report.status,
    shadowMode: true,
    paymentRequirementCaptured: Boolean(report.paymentRequirementCaptured),
    settlementReady: false,
    liveSettlementEnabled: false,
    responseStatus: report.responseStatus,
    veniceSettlement: report.veniceSettlement,
    selectedOffer: report.selectedOffer
      ? {
          scheme: report.selectedOffer.scheme,
          network: report.selectedOffer.network,
          asset: report.selectedOffer.asset,
          payToHash: hashPublicIdentifier(report.selectedOffer.payTo),
          amountAtoms: report.selectedOffer.amountAtoms,
        }
      : null,
    currentRelayProof: report.currentRelayProof,
    relayProofMatchesVeniceSettlement: Boolean(report.relayProofMatchesVeniceSettlement),
    packageReadiness: summarizePackageReadiness(packageReport),
    issues: Array.isArray(report.issues) ? report.issues : [],
    noGoFor: Array.isArray(report.noGoFor) ? report.noGoFor : [],
  };
}

export async function loadVeniceX402DelegationModules({
  importer = importOptionalPackage,
} = {}) {
  const entries = await Promise.all(
    VENICE_X402_REQUIRED_PACKAGES.map(async (specifier) => {
      try {
        return [specifier, {available: true, module: await importer(specifier), error: null}];
      } catch (error) {
        return [specifier, {available: false, module: null, error: error.message ?? String(error)}];
      }
    }),
  );
  const packages = Object.fromEntries(entries);
  const missingPackages = Object.entries(packages)
    .filter(([, result]) => !result.available)
    .map(([specifier]) => specifier);

  return {
    packages,
    missingPackages,
    allAvailable: missingPackages.length === 0,
    expectedExports: {
      "@x402/fetch": ["wrapFetchWithPayment"],
      "@metamask/x402": ["createx402DelegationProvider"],
      "@x402/core": ["x402Client or equivalent x402 client primitives"],
    },
  };
}

export function buildVeniceX402LiveReadinessReport({
  paymentRequired,
  paymentRequiredHeader,
  chainProfile = "base-mainnet",
  settlementEnabled = false,
  packageReport = {allAvailable: false, missingPackages: VENICE_X402_REQUIRED_PACKAGES},
  maxTopUpUsdc = process.env.HALO_MAINNET_MAX_VENICE_TOPUP_USDC || DEFAULT_MAINNET_MAX_VENICE_TOPUP_USDC,
  maxPerRequestUsdc = process.env.HALO_MAINNET_MAX_X402_PER_REQUEST_USDC || DEFAULT_MAINNET_MAX_X402_PER_REQUEST_USDC,
} = {}) {
  const issues = [];
  const profile = getHaloChainProfile(chainProfile);
  let parsedPaymentRequired = paymentRequired ?? null;
  let offer = null;

  if (!parsedPaymentRequired && paymentRequiredHeader) {
    try {
      parsedPaymentRequired = parsePaymentRequiredHeader(paymentRequiredHeader);
    } catch (error) {
      issues.push(`Venice PAYMENT-REQUIRED header could not be parsed: ${error.message}`);
    }
  }

  if (!profile.mainnet || profile.chainId !== VENICE_X402_CHAIN_ID) {
    issues.push("Venice x402 live settlement requires Base mainnet profile eip155:8453");
  }

  if (!parsedPaymentRequired) {
    issues.push("Venice x402 payment requirement is required before live settlement");
  } else {
    try {
      offer = selectUsdcPaymentOffer(parsedPaymentRequired, {
        asset: VENICE_X402_BASE_USDC_ADDRESS,
        network: VENICE_X402_NETWORK,
      });
    } catch (error) {
      issues.push(error.message);
    }
  }

  const maxTopUpAtoms = decimalUsdcToAtoms(maxTopUpUsdc, "HALO_MAINNET_MAX_VENICE_TOPUP_USDC");
  const maxPerRequestAtoms = decimalUsdcToAtoms(maxPerRequestUsdc, "HALO_MAINNET_MAX_X402_PER_REQUEST_USDC");
  if (offer?.amountAtoms !== undefined && offer.amountAtoms > maxPerRequestAtoms) {
    issues.push(`Venice x402 request amount ${offer.amountAtoms.toString()} atoms exceeds cap ${maxPerRequestAtoms.toString()}`);
  }
  if (offer?.amountAtoms !== undefined && offer.amountAtoms > maxTopUpAtoms) {
    issues.push(`Venice x402 top-up amount ${offer.amountAtoms.toString()} atoms exceeds cap ${maxTopUpAtoms.toString()}`);
  }

  if (!settlementEnabled) {
    issues.push("live Venice x402 settlement is disabled");
  }

  if (!packageReport.allAvailable) {
    issues.push(`missing x402 delegation package(s): ${(packageReport.missingPackages ?? VENICE_X402_REQUIRED_PACKAGES).join(", ")}`);
  }

  const status = issues.length > 0 ? VENICE_X402_LIVE_STATUS.BLOCKED : VENICE_X402_LIVE_STATUS.READY;

  return {
    step: "venice-x402-live",
    title: "Venice x402 live delegation readiness",
    status,
    shadowMode: false,
    settlementReady: status === VENICE_X402_LIVE_STATUS.READY,
    liveSettlementEnabled: settlementEnabled,
    chainProfile: profile.id,
    chainId: String(profile.chainId),
    network: VENICE_X402_NETWORK,
    asset: normalizeAddress(VENICE_X402_BASE_USDC_ADDRESS, "VENICE_X402_BASE_USDC_ADDRESS"),
    selectedOffer: offer
      ? {
          scheme: offer.scheme,
          network: offer.network,
          asset: offer.asset,
          payTo: offer.payTo,
          amountAtoms: offer.amountAtoms.toString(),
        }
      : null,
    maxTopUpAtoms: maxTopUpAtoms.toString(),
    maxPerRequestAtoms: maxPerRequestAtoms.toString(),
    packages: packageReport,
    issues,
    noGoFor: status === VENICE_X402_LIVE_STATUS.READY
      ? []
      : ["live_x402_settlement", "paid_venice_claim"],
  };
}

export async function createVeniceX402DelegatedFetchPlan({
  paymentRequired,
  walletClient,
  baseFetch = globalThis.fetch,
  importer,
  settlementEnabled = false,
  chainProfile = "base-mainnet",
} = {}) {
  const packageReport = await loadVeniceX402DelegationModules({importer});
  const readiness = buildVeniceX402LiveReadinessReport({
    paymentRequired,
    packageReport,
    settlementEnabled,
    chainProfile,
  });

  if (!readiness.settlementReady) {
    return {
      readiness,
      provider: null,
      paidFetch: null,
    };
  }

  const fetchModule = packageReport.packages["@x402/fetch"].module;
  const metamaskModule = packageReport.packages["@metamask/x402"].module;
  const wrapFetchWithPayment = fetchModule.wrapFetchWithPayment;
  const createx402DelegationProvider = metamaskModule.createx402DelegationProvider;
  if (typeof wrapFetchWithPayment !== "function") {
    throw new TypeError("@x402/fetch.wrapFetchWithPayment is required");
  }
  if (typeof createx402DelegationProvider !== "function") {
    throw new TypeError("@metamask/x402.createx402DelegationProvider is required");
  }

  const provider = createx402DelegationProvider({
    walletClient,
    chainId: VENICE_X402_CHAIN_ID,
    network: VENICE_X402_NETWORK,
    asset: VENICE_X402_BASE_USDC_ADDRESS,
    maxAmountRequired: readiness.maxPerRequestAtoms,
  });

  return {
    readiness,
    provider,
    paidFetch: wrapFetchWithPayment(baseFetch, provider),
  };
}

export function prepareVeniceX402TopUpRelay({
  chainId,
  paymentRequired,
  permissionContext,
  destinationUrl,
  quoteContext,
  asset,
  network,
}) {
  const offer = selectUsdcPaymentOffer(paymentRequired, {asset, network});
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

function buildReceiptVerificationBody({need, requestedAmountUsd, receiptImageUrl, receiptEvidence = null, model}) {
  return {
    model: requireNonEmptyString(model, "model"),
    messages: buildReceiptVerificationMessages({need, requestedAmountUsd, receiptImageUrl, receiptEvidence}),
    response_format: {type: "json_object"},
    temperature: 0,
  };
}

function formatReceiptEvidenceLines(receiptEvidence) {
  if (!receiptEvidence || typeof receiptEvidence !== "object" || Array.isArray(receiptEvidence)) {
    return [];
  }

  const fields = [
    ["Vendor", receiptEvidence.vendor],
    ["Item", receiptEvidence.item],
    ["Category", receiptEvidence.category],
    ["Date", receiptEvidence.date],
    ["Total", receiptEvidence.totalUsd ? `$${receiptEvidence.totalUsd}` : ""],
  ].filter(([, value]) => typeof value === "string" && value.trim() !== "");

  if (fields.length === 0) {
    return [];
  }

  return [
    "Local receipt fields shown in the requester UI:",
    ...fields.map(([label, value]) => `- ${label}: ${String(value).trim()}`),
  ];
}

function normalizeVeniceDecimalString(value) {
  const text = String(value).trim().replace(/,/g, "");
  const match = text.match(/(?:USD\s*)?\$?\s*(\d+(?:\.\d+)?)/i);
  return match ? match[1] : text;
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

function parsePaymentRequiredValue(value) {
  try {
    return parseJsonObject(value);
  } catch (directError) {
    const decoded = decodePaymentRequiredHeader(value);
    if (!decoded) {
      throw directError;
    }

    try {
      return parseJsonObject(decoded);
    } catch {
      throw directError;
    }
  }
}

function getPaymentRequiredBodyCandidate(body) {
  const candidates = [
    body,
    body?.paymentRequired,
    body?.payment_required,
    body?.data?.paymentRequired,
    body?.data?.payment_required,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const offers = Array.isArray(candidate.accepts)
        ? candidate.accepts
        : Array.isArray(candidate.accept)
          ? candidate.accept
          : [];
      if (offers.length > 0) {
        return candidate;
      }
    }
  }

  return null;
}

function decodePaymentRequiredHeader(value) {
  if (typeof value !== "string") {
    return "";
  }

  const compact = value.trim();
  if (!compact || compact.includes("{")) {
    return "";
  }

  const padded = compact
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(compact.length / 4) * 4, "=");

  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function paymentNetworkMatches(candidateNetwork, expectedNetwork) {
  if (!expectedNetwork) {
    return true;
  }

  if (!candidateNetwork) {
    return false;
  }

  const expected = String(expectedNetwork).toLowerCase();
  if (candidateNetwork === expected || candidateNetwork.includes(expected) || expected.includes(candidateNetwork)) {
    return true;
  }

  if (expected === VENICE_X402_NETWORK) {
    return candidateNetwork === "base" || candidateNetwork === "base-mainnet";
  }

  return false;
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

function summarizePackageReadiness(packageReport) {
  if (!packageReport) {
    return null;
  }

  const packages = {};
  for (const [specifier, result] of Object.entries(packageReport.packages ?? {})) {
    packages[specifier] = {
      available: Boolean(result?.available),
    };
  }

  return {
    allAvailable: Boolean(packageReport.allAvailable),
    missingPackages: Array.isArray(packageReport.missingPackages) ? packageReport.missingPackages : [],
    packages,
  };
}

function hashPublicIdentifier(value) {
  const normalized = requireNonEmptyString(value, "identifier").toLowerCase();
  return `sha256:${createHash("sha256").update(normalized).digest("hex")}`;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function importOptionalPackage(specifier) {
  const dynamicImport = Function("specifier", "return import(specifier)");
  return dynamicImport(specifier);
}
