import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  RELAY_CONFIRMATION_STATUS,
  buildOneShotStatusPayload,
  buildRelayConfirmationReport,
  classifyOneShotStatusResult,
  extractOneShotTaskId,
  formatRelayConfirmationLogs,
  pollOneShotRelayStatus,
  summarizeOneShotSendResult,
} from "../../lib/oneShotRelayConfirmation.mjs";

const taskId = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const txHash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("1Shot relay confirmation", () => {
  it("extracts and redacts task ids from send results", () => {
    assert.equal(extractOneShotTaskId(taskId), taskId);
    assert.equal(extractOneShotTaskId({taskId}), taskId);
    assert.equal(extractOneShotTaskId({id: taskId}), taskId);
    assert.equal(extractOneShotTaskId({task: {id: taskId}}), taskId);

    const directSummary = summarizeOneShotSendResult(taskId);
    assert.equal(directSummary.resultType, "string");
    assert.equal(directSummary.taskIdPresent, true);

    const summary = summarizeOneShotSendResult({taskId, extra: "value"});
    assert.equal(summary.resultType, "object");
    assert.equal(summary.taskIdPresent, true);
    assert.match(summary.taskIdHash, /^sha256:/);
    assert.deepEqual(summary.resultKeys, ["extra", "taskId"]);
  });

  it("normalizes relayer status results into grant-status events", () => {
    const payload = buildOneShotStatusPayload({
      taskId,
      grantId: "grant-step19",
      statusResult: {
        status: "success",
        transactionHash: txHash,
        logs: ["submitted", "confirmed"],
      },
    });
    const classification = classifyOneShotStatusResult({taskId, statusResult: payload});

    assert.equal(payload.metadata.grantId, "grant-step19");
    assert.equal(classification.status, RELAY_CONFIRMATION_STATUS.STATUS_PAID);
    assert.equal(classification.grantStatus, "PAID");
    assert.equal(classification.txHashPresent, true);
    assert.match(classification.txHashHash, /^sha256:/);
  });

  it("classifies submitted statuses as relaying rather than paid", () => {
    const classification = classifyOneShotStatusResult({
      taskId,
      statusResult: {status: "submitted"},
    });

    assert.equal(classification.status, RELAY_CONFIRMATION_STATUS.STATUS_RELAYING);
    assert.equal(classification.grantStatus, "RELAYING");
  });

  it("returns unknown status when the relayer result cannot be normalized", () => {
    const classification = classifyOneShotStatusResult({
      taskId,
      statusResult: {message: "still processing"},
    });

    assert.equal(classification.status, RELAY_CONFIRMATION_STATUS.STATUS_UNKNOWN);
    assert.ok(classification.issues.some((issue) => issue.includes("status")));
  });

  it("polls relayer status until a terminal paid result appears", async () => {
    let calls = 0;
    const poll = await pollOneShotRelayStatus({
      taskId,
      attempts: 3,
      intervalMs: 0,
      fetchImpl: async (_url, init) => {
        calls += 1;
        const request = JSON.parse(init.body);
        assert.equal(request.method, "relayer_getStatus");
        assert.equal(request.params.id, taskId);
        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: request.id,
            result: calls === 1 ? {status: "submitted"} : {status: "success", txHash},
          }),
        };
      },
    });

    assert.equal(calls, 2);
    assert.equal(poll.classification.status, RELAY_CONFIRMATION_STATUS.STATUS_PAID);
  });

  it("builds recording-safe reports for dry-run and paid paths", () => {
    const dryRun = buildRelayConfirmationReport({liveSendEnabled: false});
    assert.equal(dryRun.status, RELAY_CONFIRMATION_STATUS.DRY_RUN_READY);
    assert.ok(formatRelayConfirmationLogs(dryRun).some((line) => line.includes("live send is still disabled")));

    const step20DryRun = buildRelayConfirmationReport({step: 20, liveSendEnabled: false});
    assert.ok(formatRelayConfirmationLogs(step20DryRun).some((line) => line.includes("Step 20 send path")));

    const paid = buildRelayConfirmationReport({
      liveSendEnabled: true,
      sendResult: {taskId},
      statusPoll: {
        attempts: 1,
        result: {status: "success", txHash},
        classification: classifyOneShotStatusResult({taskId, statusResult: {status: "success", txHash}}),
      },
    });

    assert.equal(paid.status, RELAY_CONFIRMATION_STATUS.STATUS_PAID);
    assert.equal(paid.noGoFor.length, 0);
    assert.match(paid.taskIdHash, /^sha256:/);
    assert.match(paid.txHashHash, /^sha256:/);
  });

  it("reports null send results as blocked relay confirmation", () => {
    const report = buildRelayConfirmationReport({
      liveSendEnabled: true,
      sendResult: null,
    });

    assert.equal(report.status, RELAY_CONFIRMATION_STATUS.BLOCKED);
    assert.equal(report.sendResultType, "null");
    assert.ok(report.issues.some((issue) => issue.includes("0x-prefixed TaskId string")));
  });
});
