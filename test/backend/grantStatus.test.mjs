import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GRANT_STATUS,
  createGrantStatusStore,
  normalizeOneShotStatus,
  parseOneShotWebhookPayload,
  reduceGrantEvent,
} from "../../lib/grantStatus.mjs";

const taskId =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const txHash =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("Halo grant status webhooks", () => {
  it("normalizes 1Shot webhook payloads into grant events", () => {
    const event = parseOneShotWebhookPayload(
      {
        id: taskId,
        status: "tx_success",
        txHash,
        metadata: { grantId: "grant-001" },
        logs: ["submitted", "confirmed"],
      },
      new Date("2026-06-02T12:00:00.000Z"),
    );

    assert.equal(event.taskId, taskId);
    assert.equal(event.grantId, "grant-001");
    assert.equal(event.status, GRANT_STATUS.PAID);
    assert.equal(event.txHash, txHash);
    assert.deepEqual(event.logs, ["submitted", "confirmed"]);
    assert.equal(event.receivedAt, "2026-06-02T12:00:00.000Z");
  });

  it("keeps grant events append-only and does not downgrade paid grants", () => {
    const relaying = parseOneShotWebhookPayload({
      taskId,
      status: "submitted",
      metadata: { grantId: "grant-001" },
      receivedAt: "2026-06-02T12:00:00.000Z",
    });
    const paid = parseOneShotWebhookPayload({
      taskId,
      status: "success",
      transactionHash: txHash,
      metadata: { grantId: "grant-001" },
      receivedAt: "2026-06-02T12:01:00.000Z",
    });
    const latePending = parseOneShotWebhookPayload({
      taskId,
      status: "pending",
      metadata: { grantId: "grant-001" },
      receivedAt: "2026-06-02T12:02:00.000Z",
    });

    const first = reduceGrantEvent(null, relaying);
    const second = reduceGrantEvent(first, paid);
    const third = reduceGrantEvent(second, latePending);

    assert.equal(first.status, GRANT_STATUS.RELAYING);
    assert.equal(second.status, GRANT_STATUS.PAID);
    assert.equal(third.status, GRANT_STATUS.PAID);
    assert.equal(third.txHash, txHash);
    assert.equal(third.events.length, 3);
  });

  it("normalizes numeric 1Shot relayer statuses", () => {
    assert.equal(normalizeOneShotStatus(100), GRANT_STATUS.RELAYING);
    assert.equal(normalizeOneShotStatus(110), GRANT_STATUS.RELAYING);
    assert.equal(normalizeOneShotStatus(200), GRANT_STATUS.PAID);
    assert.equal(normalizeOneShotStatus(400), GRANT_STATUS.FAILED);
    assert.equal(normalizeOneShotStatus(500), GRANT_STATUS.FAILED);
  });

  it("normalizes public-relayer webhook type/data payloads", () => {
    const submitted = parseOneShotWebhookPayload({
      type: 4,
      data: {
        id: taskId,
        hash: txHash,
      },
      receivedAt: "2026-06-02T12:00:00.000Z",
    });
    const confirmed = parseOneShotWebhookPayload({
      type: 0,
      data: {
        id: taskId,
        status: 200,
        receipt: {
          transactionHash: txHash,
          logs: ["confirmed"],
        },
      },
      receivedAt: "2026-06-02T12:01:00.000Z",
    });

    assert.equal(submitted.status, GRANT_STATUS.RELAYING);
    assert.equal(submitted.rawStatus, "4");
    assert.equal(submitted.txHash, txHash);
    assert.equal(confirmed.status, GRANT_STATUS.PAID);
    assert.equal(confirmed.rawStatus, "200");
    assert.equal(confirmed.txHash, txHash);
    assert.deepEqual(confirmed.logs, ["confirmed"]);
  });

  it("stores and lists grant statuses newest first", () => {
    const store = createGrantStatusStore();

    store.record({
      taskId: "task-old",
      status: "pending",
      receivedAt: "2026-06-02T12:00:00.000Z",
    });
    store.record({
      taskId: "task-new",
      status: "success",
      receivedAt: "2026-06-02T12:05:00.000Z",
    });

    const grants = store.list();

    assert.equal(grants.length, 2);
    assert.equal(grants[0].taskId, "task-new");
    assert.equal(grants[0].status, GRANT_STATUS.PAID);
    assert.equal(store.get("task-old").status, GRANT_STATUS.RELAYING);
  });

  it("rejects unknown statuses and malformed transaction hashes", () => {
    assert.throws(
      () =>
        parseOneShotWebhookPayload({
          taskId,
          status: "mystery",
        }),
      /unsupported 1Shot webhook status/,
    );

    assert.throws(
      () =>
        parseOneShotWebhookPayload({
          taskId,
          status: "success",
          txHash: "not-a-hash",
        }),
      /txHash must be 0x-prefixed byte data/,
    );
  });
});
