import {
  VENICE_X402_BASE_USDC_ADDRESS,
  VENICE_X402_NETWORK,
  buildVeniceTopUpProbeRequest,
  buildVeniceX402LiveReadinessReport,
  buildVeniceX402ShadowProbeReport,
  buildVeniceX402ShadowPublicSummary,
  extractVeniceX402PaymentRequirement,
  loadVeniceX402DelegationModules,
} from "../lib/veniceVerifier.mjs";

let responseStatus = null;
let responseBody = null;
let extraction = null;
let extractionIssue = "";

console.log("[HALO] Step 22 Venice x402 shadow probe.");
console.log("[HALO] Goal: capture Venice's real x402 payment requirement without settlement.");
console.log("[BOUNDARY] No X-402-Payment header, no USDC spend, no A2A claim, no 7702 claim, no 1Shot send, no paid claim.");
console.log("");

const request = buildVeniceTopUpProbeRequest();
console.log(`[VENICE] discovery endpoint=${request.url}.`);
console.log(`[VENICE] method=${request.init.method}.`);
console.log(`[SECURITY] X-402-Payment header sent=${Boolean(request.init.headers?.["X-402-Payment"])}.`);
console.log(`[VENICE] expected discovery status=402.`);

try {
  const response = await fetch(request.url, request.init);
  responseStatus = response.status;
  responseBody = await readVenicePayload(response);
  console.log(`[VENICE] response status=${responseStatus}.`);
  console.log(`[VENICE] PAYMENT-REQUIRED header captured=${hasPaymentRequiredHeader(response.headers)}.`);

  try {
    extraction = extractVeniceX402PaymentRequirement({
      headers: response.headers,
      body: responseBody,
    });
    console.log(`[VENICE] payment requirement source=${extraction.source}.`);
  } catch (error) {
    extractionIssue = error.message ?? String(error);
    console.log(`[NO-GO] ${extractionIssue}.`);
  }
} catch (error) {
  extractionIssue = `Venice x402 discovery request failed: ${error.message ?? String(error)}`;
  console.log(`[NO-GO] ${extractionIssue}.`);
}

const packageReport = await loadVeniceX402DelegationModules();
const shadowReport = buildVeniceX402ShadowProbeReport({
  step: 22,
  responseStatus,
  paymentRequired: extraction?.paymentRequired ?? null,
  body: responseBody,
  settlementEnabled: false,
});
if (extractionIssue) {
  shadowReport.issues.push(extractionIssue);
}
const publicSummary = buildVeniceX402ShadowPublicSummary({
  report: shadowReport,
  packageReport,
});
const liveReadiness = buildVeniceX402LiveReadinessReport({
  paymentRequired: extraction?.paymentRequired ?? null,
  packageReport,
  settlementEnabled: false,
  chainProfile: "base-mainnet",
});

console.log("");
console.log("[x402] Venice settlement boundary:");
console.log(`[x402] network=${VENICE_X402_NETWORK}.`);
console.log(`[x402] baseMainnetUsdc=${VENICE_X402_BASE_USDC_ADDRESS.toLowerCase()}.`);
console.log(`[x402] paymentRequirementCaptured=${publicSummary.paymentRequirementCaptured}.`);
if (publicSummary.selectedOffer) {
  console.log(`[x402] selectedOffer.network=${publicSummary.selectedOffer.network}.`);
  console.log(`[x402] selectedOffer.asset=${publicSummary.selectedOffer.asset}.`);
  console.log(`[x402] selectedOffer.payToHash=${publicSummary.selectedOffer.payToHash}.`);
  console.log(`[x402] selectedOffer.amountAtoms=${publicSummary.selectedOffer.amountAtoms}.`);
}

console.log("");
console.log("[PACKAGES] MetaMask/x402 readiness:");
for (const [specifier, result] of Object.entries(publicSummary.packageReadiness?.packages ?? {})) {
  console.log(`[PACKAGES] ${specifier} available=${result.available}.`);
}

console.log("");
console.log("[HALO] Live settlement readiness stays blocked in Step 22:");
console.log(JSON.stringify({
  status: liveReadiness.status,
  settlementReady: liveReadiness.settlementReady,
  liveSettlementEnabled: liveReadiness.liveSettlementEnabled,
  issues: liveReadiness.issues,
}, null, 2));

console.log("");
console.log("[HALO] Step 22 public-safe summary:");
console.log(JSON.stringify(publicSummary, null, 2));
console.log("");
console.log("[NEXT] Step 23 should prove A2A redelegation chain length >=2 before any A2A public claim.");

async function readVenicePayload(response) {
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

function hasPaymentRequiredHeader(headers) {
  return Boolean(
    headers.get("PAYMENT-REQUIRED") ||
      headers.get("payment-required") ||
      headers.get("X-402-Payment-Required") ||
      headers.get("x-402-payment-required"),
  );
}
