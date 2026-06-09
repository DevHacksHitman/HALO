import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  RELAY_RECONCILIATION_STATUS,
  buildBalanceTargetSummary,
  buildRelayReconciliationReport,
  calculateBalanceDeltas,
  formatRelayReconciliationLogs,
} from "../../lib/relayReconciliation.mjs";

describe("Step 20 relay reconciliation", () => {
  it("redacts balance target addresses into hashes", () => {
    const summary = buildBalanceTargetSummary({
      donorAddress: "0x1111111111111111111111111111111111111111",
      requesterAddress: "0x2222222222222222222222222222222222222222",
      feeCollector: "0x3333333333333333333333333333333333333333",
      usdcToken: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    });

    assert.match(summary.donorHash, /^sha256:/);
    assert.match(summary.requesterHash, /^sha256:/);
    assert.match(summary.feeCollectorHash, /^sha256:/);
    assert.equal(summary.distinctTargets, true);
    assert.equal(summary.usdcToken, "0x036cbd53842c5426634e7929541ec2318f3dcf7e");
  });

  it("calculates USDC atom deltas", () => {
    const deltas = calculateBalanceDeltas(
      {donor: "2000000", requester: "1000000", feeCollector: "10000"},
      {donor: "990000", requester: "2000000", feeCollector: "20000"},
    );

    assert.equal(deltas.donorDelta, -1_010_000n);
    assert.equal(deltas.requesterDelta, 1_000_000n);
    assert.equal(deltas.feeCollectorDelta, 10_000n);
  });

  it("treats TaskId return as status-poll ready, not paid", () => {
    const report = buildRelayReconciliationReport({
      liveSendEnabled: true,
      sendAttempted: true,
      taskIdPresent: true,
    });

    assert.equal(report.status, RELAY_RECONCILIATION_STATUS.TASK_SUBMITTED);
    assert.deepEqual(report.noGoFor, ["paid_claim_until_status_or_webhook"]);
    assert.ok(formatRelayReconciliationLogs(report).some((line) => line.includes("poll relayer status")));
  });

  it("flags matching balance movement without TaskId as unresolved", () => {
    const report = buildRelayReconciliationReport({
      liveSendEnabled: true,
      sendAttempted: true,
      taskIdPresent: false,
      grantAmountAtoms: "1000000",
      feeAmountAtoms: "10000",
      beforeBalances: {donor: "2000000", requester: "0", feeCollector: "0"},
      afterBalances: {donor: "990000", requester: "1000000", feeCollector: "10000"},
    });

    assert.equal(report.status, RELAY_RECONCILIATION_STATUS.BALANCE_MOVED_WITHOUT_TASK);
    assert.equal(report.balanceMovementMatches, true);
    assert.ok(report.issues.some((issue) => issue.includes("TaskId/status")));
  });

  it("blocks when live send returns no TaskId and balances do not confirm movement", () => {
    const report = buildRelayReconciliationReport({
      liveSendEnabled: true,
      sendAttempted: true,
      taskIdPresent: false,
      grantAmountAtoms: "1000000",
      feeAmountAtoms: "10000",
      beforeBalances: {donor: "2000000", requester: "0", feeCollector: "0"},
      afterBalances: {donor: "2000000", requester: "0", feeCollector: "0"},
    });

    assert.equal(report.status, RELAY_RECONCILIATION_STATUS.NO_CONFIRMED_MOVEMENT);
    assert.equal(report.balanceMovementMatches, false);
    assert.ok(report.issues.some((issue) => issue.includes("no TaskId")));
  });

  it("keeps dry-run reconciliation out of live payout claims", () => {
    const report = buildRelayReconciliationReport({
      liveSendEnabled: false,
      sendAttempted: false,
      taskIdPresent: false,
    });

    assert.equal(report.status, RELAY_RECONCILIATION_STATUS.DRY_RUN_READY);
    assert.deepEqual(report.noGoFor, ["live_payout_claim"]);
  });
});
