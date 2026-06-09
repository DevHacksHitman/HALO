import assert from "node:assert/strict";
import {generateKeyPairSync, sign} from "node:crypto";
import {describe, it} from "node:test";

import {
  canonicalizeOneShotWebhookPayload,
  verifyOneShotWebhookSignature,
} from "../../lib/oneShotWebhookSignature.mjs";

const payload = {
  id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  status: "success",
  txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  metadata: {grantId: "grant-001"},
  logs: ["submitted", "confirmed"],
};

function signedPayload() {
  const {privateKey, publicKey} = generateKeyPairSync("ed25519");
  const canonicalPayload = canonicalizeOneShotWebhookPayload(payload);
  const signature = sign(null, Buffer.from(canonicalPayload, "utf8"), privateKey).toString("base64");
  const publicKeyBytes = Buffer.from(publicKey.export({format: "der", type: "spki"})).subarray(-32);

  return {
    publicKey: publicKeyBytes.toString("base64"),
    payload: {
      ...payload,
      signature,
    },
  };
}

describe("1Shot webhook signature gate", () => {
  it("skips signature verification for local development when no public key is configured", () => {
    const result = verifyOneShotWebhookSignature(payload, {publicKey: "", required: false});

    assert.equal(result.skipped, true);
    assert.equal(result.verified, false);
    assert.equal(result.reason, "public key not configured");
  });

  it("verifies an Ed25519 signature over the canonical webhook payload", () => {
    const fixture = signedPayload();
    const result = verifyOneShotWebhookSignature(fixture.payload, {
      publicKey: fixture.publicKey,
      required: true,
    });

    assert.equal(result.verified, true);
    assert.equal(result.skipped, false);
  });

  it("rejects tampered payloads and required mode without a public key", () => {
    const fixture = signedPayload();

    assert.throws(
      () =>
        verifyOneShotWebhookSignature(
          {...fixture.payload, status: "failed"},
          {publicKey: fixture.publicKey, required: true},
        ),
      /invalid 1Shot webhook signature/,
    );

    assert.throws(
      () => verifyOneShotWebhookSignature(payload, {publicKey: "", required: true}),
      /ONESHOT_WEBHOOK_PUBLIC_KEY is required/,
    );
  });
});
