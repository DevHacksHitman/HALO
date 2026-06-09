import {createHash} from "node:crypto";

import {normalizeAddress, normalizeAmount} from "./hex.mjs";

export const RELAY_RECONCILIATION_STATUS = Object.freeze({
  BLOCKED: "NO_GO_RECONCILIATION_BLOCKED",
  DRY_RUN_READY: "CONDITIONAL_GO_RECONCILIATION_DRY_RUN",
  TASK_SUBMITTED: "CONDITIONAL_GO_TASK_SUBMITTED_FOR_STATUS",
  BALANCE_MOVED_WITHOUT_TASK: "CHECK_BALANCE_MOVED_WITHOUT_TASKID",
  NO_CONFIRMED_MOVEMENT: "NO_GO_NO_TASKID_NO_CONFIRMED_MOVEMENT",
});

export function buildBalanceTargetSummary({donorAddress, requesterAddress, feeCollector, usdcToken} = {}) {
  const donor = normalizeAddress(donorAddress, "donorAddress");
  const requester = normalizeAddress(requesterAddress, "requesterAddress");
  const collector = normalizeAddress(feeCollector, "feeCollector");
  const token = normalizeAddress(usdcToken, "usdcToken");

  return {
    donorHash: hashString(donor),
    requesterHash: hashString(requester),
    feeCollectorHash: hashString(collector),
    usdcToken: token,
    distinctTargets: new Set([donor, requester, collector]).size === 3,
  };
}

export function calculateBalanceDeltas(before = {}, after = {}) {
  return {
    donorDelta: normalizeAmount(after.donor ?? 0, "after.donor") - normalizeAmount(before.donor ?? 0, "before.donor"),
    requesterDelta:
      normalizeAmount(after.requester ?? 0, "after.requester") - normalizeAmount(before.requester ?? 0, "before.requester"),
    feeCollectorDelta:
      normalizeAmount(after.feeCollector ?? 0, "after.feeCollector") -
      normalizeAmount(before.feeCollector ?? 0, "before.feeCollector"),
  };
}

export function buildRelayReconciliationReport({
  liveSendEnabled = false,
  sendAttempted = false,
  taskIdPresent = false,
  beforeBalances,
  afterBalances,
  grantAmountAtoms,
  feeAmountAtoms,
  issues = [],
} = {}) {
  const normalizedGrant = normalizeOptionalAmount(grantAmountAtoms, "grantAmountAtoms");
  const normalizedFee = normalizeOptionalAmount(feeAmountAtoms, "feeAmountAtoms");
  const canCompareBalances = Boolean(beforeBalances && afterBalances && normalizedGrant !== null && normalizedFee !== null);
  const deltas = canCompareBalances ? calculateBalanceDeltas(beforeBalances, afterBalances) : null;
  const requesterReceivedGrant = deltas ? deltas.requesterDelta >= normalizedGrant : false;
  const feeCollectorReceivedFee = deltas ? deltas.feeCollectorDelta >= normalizedFee : false;
  const donorDebited = deltas ? deltas.donorDelta <= -(normalizedGrant + normalizedFee) : false;
  const balanceMovementMatches =
    canCompareBalances && requesterReceivedGrant && feeCollectorReceivedFee && donorDebited;
  let status;
  const nextIssues = [...issues];

  if (nextIssues.length > 0) {
    status = RELAY_RECONCILIATION_STATUS.BLOCKED;
  } else if (!liveSendEnabled) {
    status = RELAY_RECONCILIATION_STATUS.DRY_RUN_READY;
  } else if (taskIdPresent) {
    status = RELAY_RECONCILIATION_STATUS.TASK_SUBMITTED;
  } else if (sendAttempted && balanceMovementMatches) {
    status = RELAY_RECONCILIATION_STATUS.BALANCE_MOVED_WITHOUT_TASK;
    nextIssues.push("balance movement matches expected transfer, but relayer TaskId/status is still missing");
  } else if (sendAttempted) {
    status = RELAY_RECONCILIATION_STATUS.NO_CONFIRMED_MOVEMENT;
    nextIssues.push("live send returned no TaskId and balance reconciliation did not confirm expected movement");
  } else {
    status = RELAY_RECONCILIATION_STATUS.BLOCKED;
    nextIssues.push("live send was not attempted");
  }

  return {
    step: 20,
    status,
    liveSendEnabled,
    sendAttempted,
    taskIdPresent,
    canCompareBalances,
    deltas: deltas
      ? {
          donorDelta: deltas.donorDelta.toString(),
          requesterDelta: deltas.requesterDelta.toString(),
          feeCollectorDelta: deltas.feeCollectorDelta.toString(),
        }
      : null,
    expected: {
      grantAmountAtoms: normalizedGrant?.toString() ?? null,
      feeAmountAtoms: normalizedFee?.toString() ?? null,
    },
    requesterReceivedGrant,
    feeCollectorReceivedFee,
    donorDebited,
    balanceMovementMatches,
    issues: nextIssues,
    noGoFor: taskIdPresent ? ["paid_claim_until_status_or_webhook"] : ["live_payout_claim"],
  };
}

export function formatRelayReconciliationLogs(report) {
  const lines = [
    `[RECON] live send enabled=${report.liveSendEnabled}.`,
    `[RECON] send attempted=${report.sendAttempted}.`,
    `[RECON] taskId present=${report.taskIdPresent}.`,
    `[RECON] balance comparison available=${report.canCompareBalances}.`,
  ];

  if (report.deltas) {
    lines.push(`[RECON] donor delta=${report.deltas.donorDelta} atoms.`);
    lines.push(`[RECON] requester delta=${report.deltas.requesterDelta} atoms.`);
    lines.push(`[RECON] fee collector delta=${report.deltas.feeCollectorDelta} atoms.`);
    lines.push(`[RECON] expected grant=${report.expected.grantAmountAtoms} atoms.`);
    lines.push(`[RECON] expected fee=${report.expected.feeAmountAtoms} atoms.`);
    lines.push(`[RECON] balance movement matches=${report.balanceMovementMatches}.`);
  }

  for (const issue of report.issues) {
    lines.push(`[NO-GO] ${issue}.`);
  }

  if (report.status === RELAY_RECONCILIATION_STATUS.TASK_SUBMITTED) {
    lines.push("[CONDITIONAL GO] TaskId returned; poll relayer status before any paid claim.");
  } else if (report.status === RELAY_RECONCILIATION_STATUS.BALANCE_MOVED_WITHOUT_TASK) {
    lines.push("[CHECK] Balance movement observed without TaskId; reconcile with 1Shot before public paid claim.");
  } else if (report.status === RELAY_RECONCILIATION_STATUS.DRY_RUN_READY) {
    lines.push("[CONDITIONAL GO] Reconciliation proof is ready; live send is still disabled.");
  }

  return lines;
}

function normalizeOptionalAmount(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return normalizeAmount(value, label);
}

function hashString(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}
