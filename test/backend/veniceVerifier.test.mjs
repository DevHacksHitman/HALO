import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  VENICE_X402_BASE_USDC_ADDRESS,
  VENICE_X402_LIVE_STATUS,
  VENICE_X402_NETWORK,
  VENICE_X402_SHADOW_STATUS,
  buildVeniceLiveVerifierReport,
  buildVeniceX402LiveReadinessReport,
  buildVeniceX402ShadowPublicSummary,
  buildVeniceX402ShadowProbeReport,
  buildReceiptVerificationBearerRequest,
  buildReceiptVerificationRequest,
  createVeniceX402DelegatedFetchPlan,
  buildVeniceTopUpProbeRequest,
  evaluateReceiptVerification,
  extractVeniceX402PaymentRequirement,
  loadVeniceX402DelegationModules,
  parsePaymentRequiredHeader,
  parseVeniceVerificationResult,
  prepareVeniceX402TopUpRelay,
  selectUsdcPaymentOffer,
} from "../../lib/veniceVerifier.mjs";

const chainId = 84532;
const usdcToken = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
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

const receiptImageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

describe("Halo Venice verifier", () => {
  it("builds a Venice vision request with x402 wallet auth header", () => {
    const request = buildReceiptVerificationRequest({
      xSignInWithX: "signed-wallet-auth-payload",
      need: "asthma inhaler refill",
      requestedAmountUsd: "25.00",
      receiptImageUrl,
    });

    const body = JSON.parse(request.init.body);

    assert.equal(request.url, "https://api.venice.ai/api/v1/chat/completions");
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.headers["X-Sign-In-With-X"], "signed-wallet-auth-payload");
    assert.equal(body.response_format.type, "json_object");
    assert.equal(body.temperature, 0);
    assert.equal(body.messages[0].content[1].image_url.url, receiptImageUrl);
    assert.match(body.messages[0].content[0].text, /Return strict JSON only/);
  });

  it("builds a Venice vision request with Bearer auth for live credit proof", () => {
    const request = buildReceiptVerificationBearerRequest({
      apiKey: "venice_test_key",
      need: "asthma inhaler refill",
      requestedAmountUsd: "25.00",
      receiptImageUrl,
      model: "google-gemma-3-27b-it",
    });
    const body = JSON.parse(request.init.body);

    assert.equal(request.init.headers.Authorization, "Bearer venice_test_key");
    assert.equal(request.init.headers["X-Sign-In-With-X"], undefined);
    assert.equal(body.model, "google-gemma-3-27b-it");
    assert.equal(body.response_format.type, "json_object");
    assert.match(body.messages[0].content[0].text, /grant_message/);
  });

  it("parses Venice JSON and approves a matching receipt within the grant cap", () => {
    const result = parseVeniceVerificationResult({
      choices: [
        {
          message: {
            content:
              '```json\n{"valid":true,"extracted_amount":"$25.00","category":"medicine","reason":"pharmacy receipt matches","grant_message":"Breathe easy. Halo has verified this inhaler refill."}\n```',
          },
        },
      ],
    });

    const decision = evaluateReceiptVerification({
      result,
      requestedAmountUsd: "25.00",
    });

    assert.equal(result.valid, true);
    assert.equal(result.extractedAmountAtoms, 25_000_000n);
    assert.equal(result.grantMessage, "Breathe easy. Halo has verified this inhaler refill.");
    assert.equal(decision.approved, true);
    assert.equal(decision.requestedAmountAtoms, 25_000_000n);
  });

  it("rejects invalid or insufficient receipt evidence", () => {
    const result = parseVeniceVerificationResult({
      choices: [
        {
          message: {
            content: '{"valid":false,"extracted_amount":"0","category":"unknown","reason":"not a receipt"}',
          },
        },
      ],
    });

    assert.equal(
      evaluateReceiptVerification({
        result,
        requestedAmountUsd: "25.00",
      }).approved,
      false,
    );

    assert.equal(
      evaluateReceiptVerification({
        result: {...result, valid: true, extractedAmountAtoms: 10_000_000n},
        requestedAmountUsd: "25.00",
      }).reason,
      "receipt amount is below requested amount",
    );
  });

  it("builds a Step 21 live Venice report without x402 or 1Shot claims", () => {
    const result = parseVeniceVerificationResult({
      choices: [
        {
          message: {
            content:
              '{"valid":true,"extracted_amount":"25.00 USD","category":"medicine","reason":"receipt matches inhaler refill","grant_message":"Your inhaler refill has been verified."}',
          },
        },
      ],
    });
    const decision = evaluateReceiptVerification({result, requestedAmountUsd: "25.00"});
    const report = buildVeniceLiveVerifierReport({
      apiKeyPresent: true,
      model: "google-gemma-3-27b-it",
      receiptHash: "sha256:test",
      responseStatus: 200,
      result,
      decision,
    });

    assert.equal(report.liveVenice, true);
    assert.equal(report.x402Settlement, false);
    assert.equal(report.oneShotSend, false);
    assert.equal(report.decision.approved, true);
    assert.equal(report.requesterMessage, "Your inhaler refill has been verified.");
    assert.ok(report.noGoFor.includes("x402_settlement_claim"));
    assert.equal(JSON.stringify(report).includes("venice_test_key"), false);
  });

  it("parses an x402 payment requirement and prepares a Venice top-up relay draft", () => {
    const paymentRequired = parsePaymentRequiredHeader({
      "PAYMENT-REQUIRED": JSON.stringify({
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
    });

    const offer = selectUsdcPaymentOffer(paymentRequired, {asset: usdcToken, network: "base-sepolia"});
    const topUp = prepareVeniceX402TopUpRelay({
      chainId,
      paymentRequired,
      permissionContext,
      asset: usdcToken,
      network: "base-sepolia",
      destinationUrl: "https://example.com/api/venice/webhook",
    });

    assert.equal(offer.payTo, venicePaymaster);
    assert.equal(offer.amountAtoms, 1_500_000n);
    assert.equal(topUp.kind, "VENICE_X402_TOP_UP_PAYMENT");
    assert.equal(topUp.relay.execution.target, usdcToken.toLowerCase());
    assert.deepEqual(topUp.relay.transfer, {
      recipient: venicePaymaster,
      amount: "1500000",
    });
  });

  it("rejects x402 fees above the verifier sub-agent cap", () => {
    const paymentRequired = parsePaymentRequiredHeader(
      JSON.stringify({
        accepts: [
          {
            scheme: "exact",
            network: "base-sepolia",
            asset: usdcToken,
            payTo: venicePaymaster,
            amount: "2000001",
          },
        ],
      }),
    );

    assert.throws(
      () =>
        prepareVeniceX402TopUpRelay({
          chainId,
          paymentRequired,
          permissionContext,
          asset: usdcToken,
          network: "base-sepolia",
        }),
      /feeAmount exceeds cap/,
    );
  });

  it("builds a Venice x402 top-up probe request without claiming a live payment", () => {
    const request = buildVeniceTopUpProbeRequest();

    assert.equal(request.url, "https://api.venice.ai/api/v1/x402/top-up");
    assert.equal(request.init.method, "POST");
    assert.deepEqual(request.init.headers, {});
    assert.equal(request.init.headers["X-402-Payment"], undefined);
    assert.equal("body" in request.init, false);
  });

  it("treats Venice x402 discovery 402 as shadow-probe success", () => {
    const paymentRequired = {
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
    const report = buildVeniceX402ShadowProbeReport({
      step: 22,
      responseStatus: 402,
      paymentRequired,
      currentRelayChainId: chainId,
      currentRelayAsset: usdcToken,
    });

    assert.equal(report.step, 22);
    assert.equal(report.status, VENICE_X402_SHADOW_STATUS.READY);
    assert.equal(report.paymentRequirementCaptured, true);
    assert.equal(report.settlementReady, false);
    assert.equal(report.liveSettlementEnabled, false);
  });

  it("extracts Venice x402 requirements from response body when the header is absent", () => {
    const body = {
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
    const extracted = extractVeniceX402PaymentRequirement({headers: {}, body});

    assert.equal(extracted.source, "response body");
    assert.equal(extracted.headerPresent, false);
    assert.deepEqual(extracted.paymentRequired, body);
  });

  it("parses base64 x402 headers and keeps Venice settlement in shadow mode", () => {
    const paymentRequired = {
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
    const paymentRequiredHeader = Buffer.from(JSON.stringify(paymentRequired), "utf8").toString("base64url");
    const parsed = parsePaymentRequiredHeader(paymentRequiredHeader);
    const report = buildVeniceX402ShadowProbeReport({
      responseStatus: 402,
      paymentRequired: parsed,
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

    assert.equal(parsed.x402Version, 2);
    assert.equal(report.status, VENICE_X402_SHADOW_STATUS.READY);
    assert.equal(report.shadowMode, true);
    assert.equal(report.paymentRequirementCaptured, true);
    assert.equal(report.settlementReady, false);
    assert.equal(report.liveSettlementEnabled, false);
    assert.equal(report.veniceSettlement.chainId, "8453");
    assert.equal(report.veniceSettlement.network, "eip155:8453");
    assert.equal(report.selectedOffer.asset, VENICE_X402_BASE_USDC_ADDRESS.toLowerCase());
    assert.equal(report.selectedOffer.amountAtoms, "5000000");
    assert.equal(report.currentRelayProof.chainId, "84532");
    assert.equal(report.relayProofMatchesVeniceSettlement, false);
    assert.ok(report.noGoFor.includes("live_x402_settlement"));
  });

  it("builds a recording-safe Step 22 summary without raw payTo or payment headers", () => {
    const paymentRequired = {
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
    const report = buildVeniceX402ShadowProbeReport({
      step: 22,
      responseStatus: 402,
      paymentRequired,
      currentRelayChainId: chainId,
      currentRelayAsset: usdcToken,
    });
    const publicSummary = buildVeniceX402ShadowPublicSummary({
      report,
      packageReport: {
        allAvailable: true,
        missingPackages: [],
        packages: {
          "@x402/core": {available: true, module: {}},
          "@x402/fetch": {available: true, module: {}},
          "@metamask/x402": {available: true, module: {}},
        },
      },
    });
    const serialized = JSON.stringify(publicSummary);

    assert.equal(publicSummary.step, 22);
    assert.equal(publicSummary.selectedOffer.payToHash.startsWith("sha256:"), true);
    assert.equal(publicSummary.selectedOffer.payTo, undefined);
    assert.equal(publicSummary.settlementReady, false);
    assert.equal(serialized.includes(venicePaymaster), false);
    assert.equal(serialized.includes("X-402-Payment"), false);
  });

  it("blocks Venice x402 live settlement outside Base mainnet or above per-request caps", () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [
        {
          protocol: "x402",
          version: 2,
          scheme: "exact",
          network: VENICE_X402_NETWORK,
          asset: VENICE_X402_BASE_USDC_ADDRESS,
          payTo: venicePaymaster,
          amount: "1000001",
        },
      ],
    };

    const report = buildVeniceX402LiveReadinessReport({
      paymentRequired,
      chainProfile: "base-sepolia",
      settlementEnabled: true,
      packageReport: {allAvailable: true, missingPackages: []},
      maxPerRequestUsdc: "1",
      maxTopUpUsdc: "5",
    });

    assert.equal(report.status, VENICE_X402_LIVE_STATUS.BLOCKED);
    assert.ok(report.issues.some((issue) => issue.includes("Base mainnet")));
    assert.ok(report.issues.some((issue) => issue.includes("exceeds cap")));
  });

  it("marks Venice x402 live readiness only when Base mainnet, packages, and caps align", () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [
        {
          protocol: "x402",
          version: 2,
          scheme: "exact",
          network: VENICE_X402_NETWORK,
          asset: VENICE_X402_BASE_USDC_ADDRESS,
          payTo: venicePaymaster,
          amount: "1000000",
        },
      ],
    };
    const report = buildVeniceX402LiveReadinessReport({
      paymentRequired,
      chainProfile: "base-mainnet",
      settlementEnabled: true,
      packageReport: {allAvailable: true, missingPackages: []},
      maxPerRequestUsdc: "1",
      maxTopUpUsdc: "5",
    });

    assert.equal(report.status, VENICE_X402_LIVE_STATUS.READY);
    assert.equal(report.settlementReady, true);
    assert.equal(report.chainId, "8453");
    assert.equal(report.selectedOffer.amountAtoms, "1000000");
  });

  it("loads optional x402 packages and keeps live fetch unavailable when modules are missing", async () => {
    const packageReport = await loadVeniceX402DelegationModules({
      importer: async (specifier) => {
        if (specifier === "@x402/core") {
          return {x402Client: () => null};
        }
        throw new Error("module not installed");
      },
    });

    assert.equal(packageReport.allAvailable, false);
    assert.ok(packageReport.missingPackages.includes("@x402/fetch"));
  });

  it("creates a guarded delegated fetch plan when package adapters are available", async () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [
        {
          protocol: "x402",
          version: 2,
          scheme: "exact",
          network: VENICE_X402_NETWORK,
          asset: VENICE_X402_BASE_USDC_ADDRESS,
          payTo: venicePaymaster,
          amount: "1000000",
        },
      ],
    };
    const importer = async (specifier) => {
      if (specifier === "@x402/fetch") {
        return {wrapFetchWithPayment: (fetchImpl, provider) => ({fetchImpl, provider})};
      }
      if (specifier === "@metamask/x402") {
        return {createx402DelegationProvider: (config) => ({kind: "provider", config})};
      }
      return {x402Client: () => null};
    };
    const plan = await createVeniceX402DelegatedFetchPlan({
      paymentRequired,
      walletClient: {account: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
      baseFetch: async () => null,
      importer,
      settlementEnabled: true,
      chainProfile: "base-mainnet",
    });

    assert.equal(plan.readiness.status, VENICE_X402_LIVE_STATUS.READY);
    assert.equal(plan.provider.kind, "provider");
    assert.equal(plan.paidFetch.provider, plan.provider);
  });
});
