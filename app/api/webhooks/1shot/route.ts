import {createHash} from "node:crypto";

import {parseOneShotWebhookPayload} from "@/lib/grantStatus.mjs";
import {getGrantStatusPersistenceInfo, recordGrantStatus} from "@/lib/grantStatusPersistence.mjs";
import {verifyOneShotWebhookSignatureWithJwks} from "@/lib/oneShotWebhookSignature.mjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown = null;

  try {
    payload = await request.json();
    const signature = await verifyOneShotWebhookSignatureWithJwks(payload);
    const event = parseOneShotWebhookPayload(payload);
    const grant = await recordGrantStatus(event);

    return Response.json({
      ok: true,
      grant,
      persistence: getGrantStatusPersistenceInfo(),
      signature,
    });
  } catch (error) {
    const debug = process.env.HALO_ONESHOT_WEBHOOK_DEBUG === "1";
    const errorMessage = error instanceof Error ? error.message : "invalid 1Shot webhook payload";
    const diagnostic = summarizeWebhookPayload(payload);

    if (debug) {
      console.warn("[1Shot webhook] rejected", {
        error: errorMessage,
        diagnostic,
      });
    }

    return Response.json(
      {
        ok: false,
        error: errorMessage,
        ...(debug ? {diagnostic} : {}),
      },
      {status: 400},
    );
  }
}

function summarizeWebhookPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      payloadType: Array.isArray(payload) ? "array" : payload === null ? "null" : typeof payload,
    };
  }

  const record = payload as Record<string, unknown>;
  const data = objectOrNull(record.data);
  const result = objectOrNull(record.result);
  const statusSource = data ?? result ?? record;
  const receipt = objectOrNull(statusSource.receipt) ?? objectOrNull(objectOrNull(statusSource.result)?.receipt);
  const taskId = firstString(
    statusSource.taskId,
    statusSource.id,
    objectOrNull(statusSource.task)?.id,
    objectOrNull(statusSource.result)?.taskId,
    objectOrNull(statusSource.result)?.id,
    record.taskId,
    record.id,
  );
  const txHash = firstString(
    statusSource.txHash,
    statusSource.transactionHash,
    statusSource.hash,
    receipt?.transactionHash,
    receipt?.hash,
    record.txHash,
    record.transactionHash,
    record.hash,
  );

  return {
    payloadKeys: Object.keys(record).sort(),
    dataKeys: data ? Object.keys(data).sort() : [],
    hasSignature: typeof record.signature === "string" && record.signature.length > 0,
    hasKeyId: typeof record.keyId === "string" && record.keyId.length > 0,
    hasKid: typeof record.kid === "string" && record.kid.length > 0,
    type: typeof record.type === "number" || typeof record.type === "string" ? String(record.type) : null,
    status: statusValue(statusSource.status ?? record.status),
    hasTaskId: Boolean(taskId),
    taskIdHash: taskId ? hashString(taskId) : null,
    hasTxHash: Boolean(txHash),
    txHashHash: txHash ? hashString(txHash) : null,
  };
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstString(...values: unknown[]) {
  const value = values.find((candidate) => typeof candidate === "string" && candidate.trim() !== "");
  return typeof value === "string" ? value.trim() : "";
}

function statusValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function hashString(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
