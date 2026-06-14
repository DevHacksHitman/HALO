import assert from "node:assert/strict";
import {generateKeyPairSync, sign} from "node:crypto";
import {describe, it} from "node:test";

import {
  buildOneShotWebhookVerificationMessages,
  canonicalizeOneShotWebhookPayload,
  resolveOneShotWebhookJwksUrl,
  verifyOneShotWebhookSignature,
  verifyOneShotWebhookSignatureWithJwks,
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

function signedPayloadWithKeyId(keyId = "halo-test-key") {
  const {privateKey, publicKey} = generateKeyPairSync("ed25519");
  const payloadWithKeyId = {
    ...payload,
    keyId,
  };
  const canonicalPayload = canonicalizeOneShotWebhookPayload(payloadWithKeyId);
  const signature = sign(null, Buffer.from(canonicalPayload, "utf8"), privateKey).toString("base64");

  return {
    jwk: {
      ...publicKey.export({format: "jwk"}),
      kid: keyId,
    },
    payload: {
      ...payloadWithKeyId,
      signature,
    },
  };
}

function signedPublicRelayerPayload({messageSelector, keyId = "halo-test-key"} = {}) {
  const {privateKey, publicKey} = generateKeyPairSync("ed25519");
  const payloadWithKeyId = {
    type: 0,
    keyId,
    data: {
      id: payload.id,
      status: 200,
      receipt: {
        transactionHash: payload.txHash,
      },
    },
  };
  const message = messageSelector(payloadWithKeyId);
  const signature = sign(null, Buffer.from(message, "utf8"), privateKey).toString("base64url");

  return {
    publicKey: Buffer.from(publicKey.export({format: "der", type: "spki"})).subarray(-32).toString("base64url"),
    payload: {
      ...payloadWithKeyId,
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

  it("resolves a webhook public key from JWKS by keyId", async () => {
    const fixture = signedPayloadWithKeyId();
    const result = await verifyOneShotWebhookSignatureWithJwks(fixture.payload, {
      publicKey: "",
      required: true,
      jwksUrl: "https://relayer.1shotapi.com/.well-known/jwks.json",
      fetchImpl: async (url, init) => {
        assert.equal(url, "https://relayer.1shotapi.com/.well-known/jwks.json");
        assert.equal(init.method, "GET");
        return {
          ok: true,
          json: async () => ({keys: [fixture.jwk]}),
        };
      },
    });

    assert.equal(result.verified, true);
    assert.equal(result.keyId, "halo-test-key");
    assert.equal(result.skipped, false);
  });

  it("exposes bounded canonicalization candidates for relayer payload variants", () => {
    const messages = buildOneShotWebhookVerificationMessages({
      type: 0,
      keyId: "halo-test-key",
      data: {status: 200, id: payload.id},
      signature: "signature",
    });
    const modes = messages.map((candidate) => candidate.mode);

    assert.deepEqual(modes, [
      "stable_without_signature",
      "json_without_signature",
      "stable_without_signature_and_key_id",
      "json_without_signature_and_key_id",
      "stable_data_only",
      "json_data_only",
    ]);
  });

  it("accepts base64url signatures over public-relayer data-only payloads", () => {
    const fixture = signedPublicRelayerPayload({
      messageSelector: (body) => JSON.stringify(body.data),
    });
    const result = verifyOneShotWebhookSignature(fixture.payload, {
      publicKey: fixture.publicKey,
      required: true,
    });

    assert.equal(result.verified, true);
    assert.equal(result.mode, "json_data_only");
  });

  it("accepts signatures that omit keyId from the signed body", () => {
    const fixture = signedPublicRelayerPayload({
      messageSelector: ({keyId: _keyId, ...body}) => JSON.stringify(body),
    });
    const result = verifyOneShotWebhookSignature(fixture.payload, {
      publicKey: fixture.publicKey,
      required: true,
    });

    assert.equal(result.verified, true);
    assert.equal(result.mode, "json_without_signature_and_key_id");
  });

  it("selects testnet JWKS by default for the Base Sepolia profile", () => {
    assert.equal(
      resolveOneShotWebhookJwksUrl({env: {}, chainProfile: "base-sepolia"}),
      "https://relayer.1shotapi.dev/.well-known/jwks.json",
    );
    assert.equal(
      resolveOneShotWebhookJwksUrl({env: {}, chainProfile: "base-mainnet"}),
      "https://relayer.1shotapi.com/.well-known/jwks.json",
    );
    assert.equal(
      resolveOneShotWebhookJwksUrl({
        env: {ONESHOT_WEBHOOK_JWKS_URL: "https://relay.example/.well-known/jwks.json"},
        chainProfile: "base-sepolia",
      }),
      "https://relay.example/.well-known/jwks.json",
    );
  });
});
