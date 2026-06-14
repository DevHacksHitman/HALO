import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  STATUS_REPOLL_STATUS,
  buildStatusRePollReport,
  formatStatusRePollLogs,
  resolveStatusRePollTaskId,
} from "../../lib/oneShotStatusRePoll.mjs";
import {GRANT_STATUS} from "../../lib/grantStatus.mjs";
import {RELAY_CONFIRMATION_STATUS} from "../../lib/oneShotRelayConfirmation.mjs";

const taskId = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const txHash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("1Shot status-only TaskId repoll", () => {
  it("resolves a Step-specific TaskId before generic fallbacks", () => {
    const resolved = resolveStatusRePollTaskId({
      step: 20,
      env: {
        HALO_STEP20_TASK_ID: taskId,
        HALO_ONESHOT_TASK_ID: "0xcccc",
      },
    });

    assert.deepEqual(resolved, {
      taskId,
      source: "HALO_STEP20_TASK_ID",
    });
  });

  it("resolves a saved local artifact TaskId after env fallbacks", () => {
    const resolved = resolveStatusRePollTaskId({
      step: 20,
      env: {},
      artifact: {
        taskId,
      },
    });

    assert.deepEqual(resolved, {
      taskId,
      source: "local-artifact",
    });
  });

  it("blocks without creating a replacement TaskId", () => {
    const report = buildStatusRePollReport({
      step: 20,
      taskId: "",
      endpoint: "https://relayer.1shotapi.dev/relayers",
      chainProfile: "base-sepolia",
    });

    assert.equal(report.status, STATUS_REPOLL_STATUS.BLOCKED);
    assert.equal(report.taskIdPresent, false);
    assert.deepEqual(report.noGoFor, ["paid_claim_until_status_or_signed_webhook"]);
    assert.ok(report.issues.some((issue) => issue.includes("do not resend")));
  });

  it("marks terminal status=200 as paid without exposing raw ids", () => {
    const report = buildStatusRePollReport({
      step: 20,
      taskId,
      taskIdSource: "HALO_STEP20_TASK_ID",
      endpoint: "https://relayer.1shotapi.dev/relayers",
      chainProfile: "base-sepolia",
      statusPoll: {
        attempts: 2,
        result: {status: 200, receipt: {transactionHash: txHash}},
        classification: {
          status: RELAY_CONFIRMATION_STATUS.STATUS_PAID,
          grantStatus: GRANT_STATUS.PAID,
          rawStatus: "200",
          txHashPresent: true,
          txHashHash: "sha256:tx",
          issues: [],
        },
      },
    });

    assert.equal(report.status, STATUS_REPOLL_STATUS.PAID);
    assert.equal(report.taskIdHash.startsWith("sha256:"), true);
    assert.equal(report.taskIdHash.includes(taskId), false);
    assert.deepEqual(report.noGoFor, []);
  });

  it("keeps submitted status=110 out of paid wording", () => {
    const report = buildStatusRePollReport({
      step: 20,
      taskId,
      statusPoll: {
        attempts: 1,
        result: {status: 110, hash: txHash},
        classification: {
          status: RELAY_CONFIRMATION_STATUS.STATUS_RELAYING,
          grantStatus: GRANT_STATUS.RELAYING,
          rawStatus: "110",
          txHashPresent: true,
          txHashHash: "sha256:tx",
          issues: [],
        },
      },
    });

    assert.equal(report.status, STATUS_REPOLL_STATUS.RELAYING);
    assert.deepEqual(report.noGoFor, ["paid_claim_until_status_or_signed_webhook"]);
  });

  it("formats no-send public logs", () => {
    const report = buildStatusRePollReport({step: 20});
    const lines = formatStatusRePollLogs(report);

    assert.ok(lines.some((line) => line.includes("taskId present=false")));
    assert.ok(lines.some((line) => line.includes("do not generate a new TaskId")));
  });
});
