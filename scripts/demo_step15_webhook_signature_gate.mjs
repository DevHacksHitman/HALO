import {generateKeyPairSync, sign} from "node:crypto";

import {
  canonicalizeOneShotWebhookPayload,
  verifyOneShotWebhookSignature,
} from "../lib/oneShotWebhookSignature.mjs";

const payload = {
  id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  status: "success",
  txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  metadata: {grantId: "grant-local-001"},
  logs: ["submitted", "confirmed"],
};

const {privateKey, publicKey} = generateKeyPairSync("ed25519");
const signature = sign(
  null,
  Buffer.from(canonicalizeOneShotWebhookPayload(payload), "utf8"),
  privateKey,
).toString("base64");
const publicKeyBytes = Buffer.from(publicKey.export({format: "der", type: "spki"})).subarray(-32);
const signedPayload = {...payload, signature};

console.log("[WEBHOOK] Signed 1Shot payload sample:");
console.log(
  JSON.stringify(
    {
      id: signedPayload.id,
      status: signedPayload.status,
      grantId: signedPayload.metadata.grantId,
      signaturePreview: `${signature.slice(0, 12)}...${signature.slice(-8)}`,
    },
    null,
    2,
  ),
);

const result = verifyOneShotWebhookSignature(signedPayload, {
  publicKey: publicKeyBytes.toString("base64"),
  required: true,
});

console.log("[SECURITY] Signature gate result:");
console.log(JSON.stringify(result, null, 2));

try {
  verifyOneShotWebhookSignature(
    {...signedPayload, status: "failed"},
    {
      publicKey: publicKeyBytes.toString("base64"),
      required: true,
    },
  );
} catch (error) {
  console.log("Tampered webhook rejected:");
  console.log(error.message);
}

const localResult = verifyOneShotWebhookSignature(payload, {
  publicKey: "",
  required: false,
});

console.log("[LOCAL] Unsigned local demo mode:");
console.log(JSON.stringify(localResult, null, 2));
