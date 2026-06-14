import {DEFAULT_VENICE_VISION_MODEL} from "../lib/veniceVerifier.mjs";
import {runVeniceLiveVerifierProof} from "../lib/demoProofs.mjs";

const need = process.env.HALO_STEP21_NEED || "asthma inhaler refill";
const requestedAmountUsd = process.env.HALO_STEP21_REQUESTED_USD || "25.00";
const model = process.env.VENICE_VISION_MODEL || DEFAULT_VENICE_VISION_MODEL;
const apiKey = process.env.VENICE_API_KEY || "";
const maxAttempts = parsePositiveInteger(process.env.HALO_STEP21_VENICE_ATTEMPTS, 3);
const retryBaseMs = parsePositiveInteger(process.env.HALO_STEP21_VENICE_RETRY_MS, 1500);

console.log("[HALO] Step 21 Venice live verifier proof.");
console.log(`[SECURITY] VENICE_API_KEY present=${Boolean(apiKey)}.`);
console.log("[SECURITY] Raw Venice API key and synthetic receipt data URL stay local-only.");
console.log("[BOUNDARY] This step uses live Venice AI credits; it does not perform x402 settlement, A2A redelegation, 7702 readiness, or 1Shot send.");
console.log("");
console.log(`[VENICE] model=${model}.`);
console.log(`[REQUEST] need=${need}.`);
console.log(`[REQUEST] requestedAmountUsd=${requestedAmountUsd}.`);

const proof = await runVeniceLiveVerifierProof({
  apiKey,
  need,
  requestedAmountUsd,
  model,
  maxAttempts,
  retryBaseMs,
});
const report = proof.report;

console.log(`[REQUEST] syntheticReceiptHash=${proof.request.receiptHash}.`);

if (proof.ok) {
  console.log("");
  console.log(`[VENICE] response status=${report.responseStatus}.`);
  console.log("[VENICE] Parsed structured verifier result:");
  console.log(JSON.stringify(report.parsedResult, null, 2));
  console.log("[HALO] Grant decision:");
  console.log(JSON.stringify(report.decision, null, 2));
  console.log(`[HALO] requester message=${report.requesterMessage}.`);
} else {
  for (const issue of report.issues) {
    console.log(`[NO-GO] ${issue}.`);
  }
}

console.log("");
console.log("[HALO] Step 21 summary:");
console.log(JSON.stringify(report, null, 2));
console.log("");
console.log("[NEXT] Step 22 should capture real Venice x402 payment requirements in shadow mode before any settlement claim.");

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
