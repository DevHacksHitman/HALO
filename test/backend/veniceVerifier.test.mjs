import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  buildReceiptVerificationRequest,
  buildVeniceTopUpProbeRequest,
  evaluateReceiptVerification,
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

  it("parses Venice JSON and approves a matching receipt within the grant cap", () => {
    const result = parseVeniceVerificationResult({
      choices: [
        {
          message: {
            content:
              '```json\n{"valid":true,"extracted_amount":"25.00","category":"medicine","reason":"pharmacy receipt matches"}\n```',
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

    const offer = selectUsdcPaymentOffer(paymentRequired, {asset: usdcToken});
    const topUp = prepareVeniceX402TopUpRelay({
      chainId,
      paymentRequired,
      permissionContext,
      asset: usdcToken,
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
        }),
      /feeAmount exceeds cap/,
    );
  });

  it("builds a Venice x402 top-up probe request without claiming a live payment", () => {
    const request = buildVeniceTopUpProbeRequest();

    assert.equal(request.url, "https://api.venice.ai/api/v1/x402/top-up");
    assert.equal(request.init.method, "POST");
    assert.deepEqual(request.init.headers, {});
    assert.equal("body" in request.init, false);
  });
});
