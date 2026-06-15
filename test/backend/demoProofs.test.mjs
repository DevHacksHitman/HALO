import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {describe, it} from "node:test";

import {
  VENICE_X402_BASE_USDC_ADDRESS,
  VENICE_X402_NETWORK,
} from "../../lib/veniceVerifier.mjs";
import {
  buildStep23A2APublicProof,
  runVeniceLiveVerifierProof,
  runVeniceX402ShadowProof,
} from "../../lib/demoProofs.mjs";
import {grantStatusStore} from "../../lib/grantStatus.mjs";

const veniceSuccessPayload = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          valid: true,
          extracted_amount: "25.00",
          category: "Medicine",
          reason: "Receipt clearly supports the inhaler refill request.",
          grant_message: "Your inhaler refill has been verified.",
        }),
      },
    },
  ],
};

const paymentRequired = {
  x402Version: 2,
  accepts: [
    {
      protocol: "x402",
      version: 2,
      scheme: "exact",
      network: VENICE_X402_NETWORK,
      asset: VENICE_X402_BASE_USDC_ADDRESS,
      payTo: "0xcccccccccccccccccccccccccccccccccccccccc",
      amount: "5000000",
    },
  ],
};

describe("frontend demo proof helpers", () => {
  it("returns a redacted approved Venice verifier proof with mocked live success", async () => {
    let capturedInit = null;
    const proof = await runVeniceLiveVerifierProof({
      apiKey: "VENICE_INFERENCE_KEY_secret",
      fetchImpl: async (_url, init) => {
        capturedInit = init;
        return jsonResponse(veniceSuccessPayload, {status: 200});
      },
      maxAttempts: 1,
    });
    const serialized = JSON.stringify(proof);

    assert.equal(proof.ok, true);
    assert.equal(proof.report.responseStatus, 200);
    assert.equal(proof.report.decision.approved, true);
    assert.equal(proof.report.requesterMessage, "Your inhaler refill has been verified.");
    assert.equal(capturedInit.headers.Authorization, "Bearer VENICE_INFERENCE_KEY_secret");
    const body = JSON.parse(capturedInit.body);
    assert.match(body.messages[0].content[0].text, /Local receipt fields shown in the requester UI/);
    assert.match(body.messages[0].content[0].text, /HALO COMMUNITY PHARMACY/);
    assert.match(body.messages[0].content[0].text, /Asthma inhaler refill/);
    assert.match(body.messages[0].content[0].text, /Total: \$25\.00/);
    assert.equal(serialized.includes("VENICE_INFERENCE_KEY_secret"), false);
    assert.equal(serialized.includes("data:image"), false);
    assert.equal(proof.request.receiptDataUrlReturned, false);
  });

  it("returns a NO-GO style Venice verifier proof when the API key is absent", async () => {
    let fetchCalled = false;
    const proof = await runVeniceLiveVerifierProof({
      apiKey: "",
      fetchImpl: async () => {
        fetchCalled = true;
        return jsonResponse({}, {status: 500});
      },
    });

    assert.equal(fetchCalled, false);
    assert.equal(proof.ok, false);
    assert.match(proof.report.status, /^NO_GO_/);
    assert.ok(proof.report.issues.some((issue) => issue.includes("VENICE_API_KEY")));
  });

  it("returns a NO-GO style Venice verifier proof for non-200 Venice responses", async () => {
    const proof = await runVeniceLiveVerifierProof({
      apiKey: "VENICE_INFERENCE_KEY_secret",
      fetchImpl: async () => jsonResponse({error: "spend limit blocked"}, {status: 402}),
      maxAttempts: 1,
    });

    assert.equal(proof.ok, false);
    assert.equal(proof.report.responseStatus, 402);
    assert.ok(proof.report.issues.some((issue) => issue.includes("spend limit blocked")));
  });

  it("captures x402 shadow requirements without sending X-402-Payment", async () => {
    let capturedInit = null;
    const proof = await runVeniceX402ShadowProof({
      fetchImpl: async (_url, init) => {
        capturedInit = init;
        return jsonResponse(
          {
            minimumTopUpUsd: 5,
            topUpInstructions: {
              network: VENICE_X402_NETWORK,
              tokenAddress: VENICE_X402_BASE_USDC_ADDRESS,
            },
          },
          {
            status: 402,
            headers: {
              "PAYMENT-REQUIRED": JSON.stringify(paymentRequired),
            },
          },
        );
      },
      packageImporter: async () => ({}),
    });

    assert.equal(capturedInit.headers["X-402-Payment"], undefined);
    assert.equal(proof.request.x402PaymentHeaderSent, false);
    assert.equal(proof.ok, true);
    assert.equal(proof.summary.responseStatus, 402);
    assert.equal(proof.summary.paymentRequirementCaptured, true);
    assert.equal(proof.summary.settlementReady, false);
    assert.equal(proof.summary.selectedOffer.network, VENICE_X402_NETWORK);
  });

  it("returns public A2A proof summaries with two-hop lanes and direct delegation rejected", () => {
    const proof = buildStep23A2APublicProof({
      relayerTargetWallet: "0x1111111111111111111111111111111111111111",
      relayerTargetIsPublic: false,
    });
    const serialized = JSON.stringify(proof);

    assert.equal(proof.ok, true);
    assert.equal(proof.summary.verifierLane.delegationChainLength, 2);
    assert.equal(proof.summary.treasurerLane.delegationChainLength, 2);
    assert.equal(proof.summary.negativeControl.delegationChainLength, 1);
    assert.match(proof.summary.negativeControl.status, /DIRECT_DELEGATION/);
    assert.equal(proof.summary.oneShotSend, false);
    assert.equal(proof.summary.x402Settlement, false);
    assert.equal(proof.summary.mainnetSend, false);
    assert.equal(serialized.includes("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), false);
    assert.equal(serialized.includes("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"), false);
    assert.equal(serialized.includes("0xabcd"), false);
  });

  it("does not mutate grant status while running frontend proof helpers", async () => {
    grantStatusStore.reset();

    await runVeniceLiveVerifierProof({
      apiKey: "VENICE_INFERENCE_KEY_secret",
      fetchImpl: async () => jsonResponse(veniceSuccessPayload, {status: 200}),
      maxAttempts: 1,
    });
    await runVeniceX402ShadowProof({
      fetchImpl: async () =>
        jsonResponse(paymentRequired, {
          status: 402,
        }),
      packageImporter: async () => ({}),
    });
    buildStep23A2APublicProof();

    assert.deepEqual(grantStatusStore.list(), []);
  });

  it("keeps proof API routes away from live 1Shot send and raw secret surfaces", async () => {
    const routeFiles = await Promise.all([
      readFile(new URL("../../app/api/venice/verify/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../../app/api/venice/x402-shadow/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../../app/api/a2a/proof/route.ts", import.meta.url), "utf8"),
    ]);
    const joined = routeFiles.join("\n");

    assert.match(joined, /runVeniceLiveVerifierProof/);
    assert.match(joined, /runVeniceX402ShadowProof/);
    assert.match(joined, /buildStep23A2APublicProof/);
    assert.doesNotMatch(joined, /relayer_send7710Transaction/);
    assert.doesNotMatch(joined, /grantStatusStore\.record/);
    assert.doesNotMatch(joined, /X-402-Payment/);
  });
});

function jsonResponse(body, {status, headers = {}}) {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
