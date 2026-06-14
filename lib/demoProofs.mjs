import {createHash} from "node:crypto";
import sharp from "sharp";
import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {
  A2A_REDELEGATION_LANES,
  A2A_REDELEGATION_STATUS,
  buildA2ARedelegationPublicSummary,
  buildA2ARedelegationProofReport,
} from "./a2aRedelegationProof.mjs";
import {
  DEFAULT_VENICE_VISION_MODEL,
  VENICE_LIVE_VERIFIER_STATUS,
  VENICE_X402_BASE_USDC_ADDRESS,
  VENICE_X402_NETWORK,
  VENICE_X402_SHADOW_STATUS,
  buildReceiptVerificationBearerRequest,
  buildVeniceLiveVerifierReport,
  buildVeniceTopUpProbeRequest,
  buildVeniceX402ShadowProbeReport,
  buildVeniceX402ShadowPublicSummary,
  evaluateReceiptVerification,
  extractVeniceX402PaymentRequirement,
  loadVeniceX402DelegationModules,
  parseVeniceVerificationResult,
} from "./veniceVerifier.mjs";

export const DEMO_REQUEST = Object.freeze({
  need: "asthma inhaler refill",
  requestedAmountUsd: "25.00",
  category: "Medicine",
  date: "2026-06-11",
  vendor: "HALO COMMUNITY PHARMACY",
});

const DEMO_DONOR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DEMO_MASTER_ALMONER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const DEMO_RELAYER_TARGET = "0x1111111111111111111111111111111111111111";
const DEMO_ALLOWED_TARGET_ENFORCER = "0x3333333333333333333333333333333333333333";
const DEMO_RECIPIENT_ENFORCER = "0x4444444444444444444444444444444444444444";
const DEMO_SPEND_LIMIT_ENFORCER = "0x5555555555555555555555555555555555555555";

export function buildSyntheticInhalerReceiptPreview() {
  return {
    vendor: DEMO_REQUEST.vendor,
    item: "Asthma inhaler refill",
    category: DEMO_REQUEST.category,
    date: DEMO_REQUEST.date,
    totalUsd: DEMO_REQUEST.requestedAmountUsd,
    synthetic: true,
  };
}

export async function buildSyntheticInhalerReceiptDataUrl({
  date = DEMO_REQUEST.date,
} = {}) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">',
    '<rect width="900" height="560" fill="#ffffff"/>',
    '<rect x="34" y="34" width="832" height="492" rx="18" fill="#fafafa" stroke="#111111" stroke-width="3"/>',
    '<text x="450" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#111111">HALO COMMUNITY PHARMACY</text>',
    '<text x="450" y="138" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#333333">Synthetic receipt for live verifier demo</text>',
    '<line x1="86" y1="174" x2="814" y2="174" stroke="#111111" stroke-width="2"/>',
    '<text x="92" y="230" font-family="Arial, sans-serif" font-size="32" fill="#111111">Item: Asthma inhaler refill</text>',
    '<text x="92" y="286" font-family="Arial, sans-serif" font-size="32" fill="#111111">Category: Medicine</text>',
    `<text x="92" y="342" font-family="Arial, sans-serif" font-size="32" fill="#111111">Date: ${escapeXml(date)}</text>`,
    '<line x1="86" y1="382" x2="814" y2="382" stroke="#111111" stroke-width="2"/>',
    '<text x="92" y="444" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#111111">TOTAL: $25.00</text>',
    '<text x="92" y="488" font-family="Arial, sans-serif" font-size="22" fill="#555555">Paid amount requested for urgent mutual aid verification.</text>',
    "</svg>",
  ].join("");

  const png = await sharp(Buffer.from(svg, "utf8")).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function runVeniceLiveVerifierProof({
  apiKey = process.env.VENICE_API_KEY || "",
  need = DEMO_REQUEST.need,
  requestedAmountUsd = DEMO_REQUEST.requestedAmountUsd,
  model = process.env.VENICE_VISION_MODEL || DEFAULT_VENICE_VISION_MODEL,
  fetchImpl = globalThis.fetch,
  maxAttempts = parsePositiveInteger(process.env.HALO_STEP21_VENICE_ATTEMPTS, 3),
  retryBaseMs = parsePositiveInteger(process.env.HALO_STEP21_VENICE_RETRY_MS, 1500),
} = {}) {
  const receiptImageUrl = await buildSyntheticInhalerReceiptDataUrl();
  const receiptHash = hashString(receiptImageUrl);
  let responseStatus = null;
  let result = null;
  let decision = null;
  let error = "";

  if (!apiKey) {
    error = "VENICE_API_KEY is required for live Venice verifier proof";
  } else if (typeof fetchImpl !== "function") {
    error = "fetch implementation is required for live Venice verifier proof";
  } else {
    try {
      const request = buildReceiptVerificationBearerRequest({
        apiKey,
        need,
        requestedAmountUsd,
        receiptImageUrl,
        model,
      });
      const {response, payload} = await fetchVeniceWithRetries(request, {
        fetchImpl,
        maxAttempts,
        retryBaseMs,
      });
      responseStatus = response.status;

      if (!response.ok) {
        error = summarizeVeniceError(payload) || `Venice request failed with HTTP ${responseStatus}`;
      } else {
        result = parseVeniceVerificationResult(payload);
        decision = evaluateReceiptVerification({result, requestedAmountUsd});
      }
    } catch (caught) {
      error = caught?.message ?? String(caught);
    }
  }

  const report = buildVeniceLiveVerifierReport({
    apiKeyPresent: Boolean(apiKey),
    model,
    receiptHash,
    responseStatus,
    result,
    decision,
    error,
  });

  return {
    ok: report.status === VENICE_LIVE_VERIFIER_STATUS.READY,
    proofType: "venice-live-verifier",
    request: {
      need,
      requestedAmountUsd,
      model,
      receiptHash,
      syntheticReceipt: buildSyntheticInhalerReceiptPreview(),
      receiptDataUrlReturned: false,
    },
    report,
    boundary: {
      liveVenice: true,
      x402Settlement: false,
      oneShotSend: false,
      paidClaim: false,
      mainnetClaim: false,
    },
    secretsRedacted: true,
  };
}

export async function runVeniceX402ShadowProof({
  fetchImpl = globalThis.fetch,
  packageImporter,
} = {}) {
  const request = buildVeniceTopUpProbeRequest();
  let responseStatus = null;
  let payload = null;
  let paymentRequired = null;
  let extractionIssue = "";

  try {
    if (typeof fetchImpl !== "function") {
      throw new TypeError("fetch implementation is required for Venice x402 shadow proof");
    }

    const response = await fetchImpl(request.url, request.init);
    responseStatus = response.status;
    payload = await readJsonPayload(response);

    try {
      const extracted = extractVeniceX402PaymentRequirement({
        headers: response.headers,
        body: payload,
      });
      paymentRequired = extracted.paymentRequired;
    } catch (caught) {
      extractionIssue = caught?.message ?? String(caught);
    }
  } catch (caught) {
    extractionIssue = caught?.message ?? String(caught);
  }

  const report = buildVeniceX402ShadowProbeReport({
    step: 22,
    responseStatus,
    paymentRequired,
    body: payload,
  });
  const packageReport = await loadVeniceX402DelegationModules(
    packageImporter ? {importer: packageImporter} : undefined,
  );
  const summary = buildVeniceX402ShadowPublicSummary({report, packageReport});
  const issues = extractionIssue ? [...summary.issues, extractionIssue] : summary.issues;
  const publicSummary = {
    ...summary,
    issues,
  };

  return {
    ok: publicSummary.status === VENICE_X402_SHADOW_STATUS.READY && issues.length === 0,
    proofType: "venice-x402-shadow",
    request: {
      endpoint: request.url,
      method: request.init.method,
      x402PaymentHeaderSent: Boolean(request.init.headers?.["X-402-Payment"]),
      bodySent: Boolean(request.init.body),
    },
    summary: publicSummary,
    boundary: {
      shadowMode: true,
      x402Settlement: false,
      oneShotSend: false,
      paidClaim: false,
      mainnetPayoutClaim: false,
    },
    secretsRedacted: true,
  };
}

export function buildStep23A2AProof({
  relayerTargetWallet = process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS || DEMO_RELAYER_TARGET,
  relayerTargetIsPublic = Boolean(process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS),
} = {}) {
  const verifierReport = buildA2ARedelegationProofReport({
    permissionContext: buildDemoRedelegatedContext({
      lane: A2A_REDELEGATION_LANES.VERIFIER_X402,
      relayerTargetWallet,
    }),
    relayerTargetWallet,
    lane: A2A_REDELEGATION_LANES.VERIFIER_X402,
    estimateStatus: "NOT_RUN_LOCAL_A2A_PROOF",
    sendStatus: "NOT_RUN_LOCAL_A2A_PROOF",
  });
  const treasurerReport = buildA2ARedelegationProofReport({
    permissionContext: buildDemoRedelegatedContext({
      lane: A2A_REDELEGATION_LANES.TREASURER_PAYOUT,
      relayerTargetWallet,
    }),
    relayerTargetWallet,
    lane: A2A_REDELEGATION_LANES.TREASURER_PAYOUT,
    estimateStatus: "NOT_RUN_LOCAL_A2A_PROOF",
    sendStatus: "NOT_RUN_LOCAL_A2A_PROOF",
  });
  const directReport = buildA2ARedelegationProofReport({
    permissionContext: buildDemoDirectContext({relayerTargetWallet}),
    relayerTargetWallet,
    lane: A2A_REDELEGATION_LANES.TREASURER_PAYOUT,
  });
  const stepReady =
    verifierReport.status === A2A_REDELEGATION_STATUS.READY &&
    treasurerReport.status === A2A_REDELEGATION_STATUS.READY &&
    directReport.status === A2A_REDELEGATION_STATUS.BLOCKED_DIRECT;

  return {
    reports: {
      verifierReport,
      treasurerReport,
      directReport,
    },
    publicSummary: {
      step: 23,
      title: "A2A redelegation proof",
      status: stepReady
        ? A2A_REDELEGATION_STATUS.READY
        : "NO_GO_A2A_STEP23_PROOF_BLOCKED",
      publicA2AClaimAllowed: stepReady,
      verifierLane: buildA2ARedelegationPublicSummary({
        report: verifierReport,
        relayerTargetIsPublic,
      }),
      treasurerLane: buildA2ARedelegationPublicSummary({
        report: treasurerReport,
        relayerTargetIsPublic,
      }),
      negativeControl: buildA2ARedelegationPublicSummary({
        report: directReport,
        relayerTargetIsPublic,
      }),
      caveatHashesDifferByLane:
        verifierReport.caveatHashes.at(-1)?.caveatsHash !== treasurerReport.caveatHashes.at(-1)?.caveatsHash,
      oneShotSend: false,
      x402Settlement: false,
      mainnetSend: false,
      veniceCall: false,
      statusSync: false,
      webhookMutation: false,
      noGoFor: [
        "live_1shot_send",
        "x402_settlement_claim",
        "paid_grant_claim",
        "mainnet_claim",
      ],
    },
  };
}

export function buildStep23A2APublicProof(options = {}) {
  const proof = buildStep23A2AProof(options);
  return {
    ok: proof.publicSummary.publicA2AClaimAllowed,
    proofType: "a2a-redelegation-proof",
    summary: proof.publicSummary,
    boundary: {
      localProof: true,
      oneShotSend: false,
      x402Settlement: false,
      paidClaim: false,
      mainnetClaim: false,
    },
    secretsRedacted: true,
  };
}

export function hashString(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

export const DEMO_X402_SETTLEMENT = Object.freeze({
  network: VENICE_X402_NETWORK,
  usdcAddress: VENICE_X402_BASE_USDC_ADDRESS,
});

function buildDemoRedelegatedContext({lane, relayerTargetWallet}) {
  return encodeDelegations([
    {
      delegate: DEMO_MASTER_ALMONER,
      delegator: DEMO_DONOR,
      authority: zeroAuthority(),
      caveats: [
        {
          enforcer: DEMO_ALLOWED_TARGET_ENFORCER,
          terms: "0x726f6f745f757364635f6d6f6e74686c795f636170",
          args: "0x",
        },
      ],
      salt: 23n,
      signature: "0xabcd",
    },
    {
      delegate: relayerTargetWallet,
      delegator: DEMO_MASTER_ALMONER,
      authority: "0x" + "23".repeat(32),
      caveats: laneCaveats(lane),
      salt: lane === A2A_REDELEGATION_LANES.VERIFIER_X402 ? 2301n : 2302n,
      signature: lane === A2A_REDELEGATION_LANES.VERIFIER_X402 ? "0xbeef" : "0xcafe",
    },
  ]);
}

function buildDemoDirectContext({relayerTargetWallet}) {
  return encodeDelegations([
    {
      delegate: relayerTargetWallet,
      delegator: DEMO_DONOR,
      authority: zeroAuthority(),
      caveats: [
        {
          enforcer: DEMO_ALLOWED_TARGET_ENFORCER,
          terms: "0x6469726563745f646f6e6f725f746f5f72656c61796572",
          args: "0x",
        },
      ],
      salt: 2300n,
      signature: "0xd1ec70",
    },
  ]);
}

function laneCaveats(lane) {
  if (lane === A2A_REDELEGATION_LANES.VERIFIER_X402) {
    return [
      {enforcer: DEMO_ALLOWED_TARGET_ENFORCER, terms: "0x76657269666965725f757364635f746172676574", args: "0x"},
      {enforcer: DEMO_RECIPIENT_ENFORCER, terms: "0x76656e6963655f783430325f7061796d6173746572", args: "0x"},
      {enforcer: DEMO_SPEND_LIMIT_ENFORCER, terms: "0x76657269666965725f6d61785f32303030303030", args: "0x"},
    ];
  }

  return [
    {enforcer: DEMO_ALLOWED_TARGET_ENFORCER, terms: "0x7472656173757265725f757364635f746172676574", args: "0x"},
    {enforcer: DEMO_RECIPIENT_ENFORCER, terms: "0x617070726f7665645f7265717565737465725f7061796f7574", args: "0x"},
    {enforcer: DEMO_SPEND_LIMIT_ENFORCER, terms: "0x7472656173757265725f6d61785f3330303030303030", args: "0x"},
  ];
}

function zeroAuthority() {
  return "0x" + "00".repeat(32);
}

async function fetchVeniceWithRetries(request, {fetchImpl, maxAttempts, retryBaseMs}) {
  let lastResponse = null;
  let lastPayload = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(request.url, request.init);
    const payload = await readJsonPayload(response);
    lastResponse = response;
    lastPayload = payload;

    if (response.ok || !shouldRetryVeniceResponse(response.status) || attempt === maxAttempts) {
      return {response, payload, attemptsUsed: attempt};
    }

    await sleep(getRetryDelayMs(response, retryBaseMs, attempt));
  }

  return {response: lastResponse, payload: lastPayload, attemptsUsed: maxAttempts};
}

async function readJsonPayload(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {error: text.slice(0, 240)};
  }
}

function summarizeVeniceError(payload) {
  if (!payload) {
    return "";
  }

  if (typeof payload.error === "string") {
    return payload.error.slice(0, 240);
  }
  if (typeof payload.message === "string") {
    return payload.message.slice(0, 240);
  }
  if (typeof payload === "string") {
    return payload.slice(0, 240);
  }

  return "";
}

function shouldRetryVeniceResponse(status) {
  return status === 429 || status === 522 || status === 524 || status >= 500;
}

function getRetryDelayMs(response, retryBaseMs, attempt) {
  const retryAfter = Number(response.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 10_000);
  }

  return Math.min(retryBaseMs * attempt, 10_000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
