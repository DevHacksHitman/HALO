import {
  VENICE_X402_BASE_USDC_ADDRESS,
  VENICE_X402_NETWORK,
  buildVeniceX402ShadowProbeReport,
  buildReceiptVerificationRequest,
  buildVeniceTopUpProbeRequest,
  evaluateReceiptVerification,
  parsePaymentRequiredHeader,
  parseVeniceVerificationResult,
  prepareVeniceX402TopUpRelay,
} from "../lib/veniceVerifier.mjs";

const chainId = 84532;
const usdcToken = process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const venicePaymaster = "0xcccccccccccccccccccccccccccccccccccccccc";
const permissionContext = [
  {
    delegate: "0x1111111111111111111111111111111111111111",
    delegator: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    authority: "0x0000000000000000000000000000000000000000",
    caveats: [
      {
        enforcer: "0x3333333333333333333333333333333333333333",
        terms: "0x",
        args: "0x",
      },
    ],
    salt: "0x1",
    signature: "0xabcd",
  },
];

const verificationRequest = buildReceiptVerificationRequest({
  xSignInWithX: "signed-siWx-demo-header",
  need: "asthma inhaler refill",
  requestedAmountUsd: "25.00",
  receiptImageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
});

console.log("[VENICE] Chat completions endpoint=" + verificationRequest.url);
console.log("[VENICE] Request uses X-Sign-In-With-X wallet auth.");
console.log("[VENICE] Verification request body:");
console.log(verificationRequest.init.body);

const veniceResult = parseVeniceVerificationResult({
  choices: [
    {
      message: {
        content:
          '{"valid":true,"extracted_amount":"25.00","category":"medicine","reason":"pharmacy receipt matches inhaler refill"}',
      },
    },
  ],
});

const decision = evaluateReceiptVerification({
  result: veniceResult,
  requestedAmountUsd: "25.00",
});

console.log("");
console.log("[VERIFIER] valid=" + veniceResult.valid);
console.log("[VERIFIER] extractedAmountAtoms=" + veniceResult.extractedAmountAtoms.toString());
console.log("[VERIFIER] approved=" + decision.approved);
console.log("[VERIFIER] reason=" + decision.reason);

console.log("");
console.log("[x402] Top-up probe request:");
console.log(JSON.stringify(buildVeniceTopUpProbeRequest(), null, 2));

const venicePaymentRequired = {
  x402Version: 2,
  accepts: [
    {
      protocol: "x402",
      version: 2,
      scheme: "exact",
      network: VENICE_X402_NETWORK,
      asset: VENICE_X402_BASE_USDC_ADDRESS,
      payTo: venicePaymaster,
      amount: "5000000",
    },
  ],
};
const shadowReport = buildVeniceX402ShadowProbeReport({
  responseStatus: 402,
  paymentRequired: venicePaymentRequired,
  body: {
    minimumTopUpUsd: 5,
    topUpInstructions: {
      network: VENICE_X402_NETWORK,
      tokenAddress: VENICE_X402_BASE_USDC_ADDRESS,
    },
  },
  currentRelayChainId: chainId,
  currentRelayAsset: usdcToken,
});

console.log("");
console.log("[x402] Shadow-mode Venice settlement boundary:");
console.log(JSON.stringify(shadowReport, null, 2));

const paymentRequired = parsePaymentRequiredHeader(
  JSON.stringify({
    accepts: [
      {
        scheme: "exact",
        network: "base-sepolia",
        asset: usdcToken,
        payTo: venicePaymaster,
        amount: "1500000",
      },
    ],
  }),
);

const topUp = prepareVeniceX402TopUpRelay({
  chainId,
  paymentRequired,
  permissionContext,
  asset: usdcToken,
  network: "base-sepolia",
  destinationUrl: "https://example.com/api/webhooks/venice",
});

console.log("");
console.log("[VENICE] Construction proof only; live x402 settlement remains NO-GO.");
for (const line of topUp.logs) {
  console.log(line);
}
console.log(`[EVM] USDC target=${topUp.relay.execution.target}`);
console.log(`[EVM] Venice payTo=${topUp.offer.payTo}`);
console.log(`[EVM] topUpAmountAtoms=${topUp.offer.amountAtoms.toString()}`);
console.log(`[1Shot] relay method=${topUp.relay.request.method}`);
console.log("[SECURITY] Live Venice/x402 spend waits for real SIWX auth + decoded MetaMask permission context.");
