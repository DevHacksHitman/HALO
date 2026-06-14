import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {
  A2A_REDELEGATION_LANES,
  A2A_REDELEGATION_STATUS,
  buildA2ARedelegationPublicSummary,
  buildA2ARedelegationProofReport,
  formatA2ARedelegationProofLogs,
} from "../../lib/a2aRedelegationProof.mjs";

const donor = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const master = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const relayerTarget = "0x1111111111111111111111111111111111111111";
const enforcer = "0x3333333333333333333333333333333333333333";
const recipientEnforcer = "0x4444444444444444444444444444444444444444";
const spendLimitEnforcer = "0x5555555555555555555555555555555555555555";

const directContext = encodeDelegations([
  {
    delegate: relayerTarget,
    delegator: donor,
    authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
    caveats: [{enforcer, terms: "0x", args: "0x"}],
    salt: 1n,
    signature: "0xabcd",
  },
]);

function buildRedelegatedContext({laneTerms, amountTerms = "0x02"} = {}) {
  return encodeDelegations([
    {
      delegate: master,
      delegator: donor,
      authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
      caveats: [
        {enforcer, terms: "0x01", args: "0x"},
      ],
      salt: 1n,
      signature: "0xabcd",
    },
    {
      delegate: relayerTarget,
      delegator: master,
      authority: "0x" + "12".repeat(32),
      caveats: [
        {enforcer, terms: laneTerms, args: "0x"},
        {enforcer: recipientEnforcer, terms: amountTerms, args: "0x"},
        {enforcer: spendLimitEnforcer, terms: "0x03", args: "0x"},
      ],
      salt: 2n,
      signature: "0xdcba",
    },
  ]);
}

const verifierRedelegatedContext = buildRedelegatedContext({laneTerms: "0x7665726966696572"});
const treasurerRedelegatedContext = buildRedelegatedContext({laneTerms: "0x747265617375726572"});
const redelegatedContext = encodeDelegations([
  {
    delegate: master,
    delegator: donor,
    authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
    caveats: [{enforcer, terms: "0x01", args: "0x"}],
    salt: 1n,
    signature: "0xabcd",
  },
  {
    delegate: relayerTarget,
    delegator: master,
    authority: "0x" + "12".repeat(32),
    caveats: [{enforcer, terms: "0x02", args: "0x"}],
    salt: 2n,
    signature: "0xdcba",
  },
]);

describe("A2A redelegation proof", () => {
  it("rejects direct donor-to-relayer delegation for A2A claims", () => {
    const report = buildA2ARedelegationProofReport({
      permissionContext: directContext,
      relayerTargetWallet: relayerTarget,
      lane: A2A_REDELEGATION_LANES.TREASURER_PAYOUT,
    });

    assert.equal(report.status, A2A_REDELEGATION_STATUS.BLOCKED_DIRECT);
    assert.equal(report.publicClaimAllowed, false);
    assert.equal(report.delegationChainLength, 1);
    assert.ok(report.issues.some((issue) => issue.includes("length >=2")));
  });

  it("accepts a Verifier x402 two-hop redelegation chain when the final delegate is the 1Shot target", () => {
    const report = buildA2ARedelegationProofReport({
      permissionContext: verifierRedelegatedContext,
      relayerTargetWallet: relayerTarget,
      lane: A2A_REDELEGATION_LANES.VERIFIER_X402,
      estimateStatus: "CONDITIONAL_GO_LIVE_ESTIMATE_READY",
    });
    const logs = formatA2ARedelegationProofLogs(report);

    assert.equal(report.status, A2A_REDELEGATION_STATUS.READY);
    assert.equal(report.publicClaimAllowed, true);
    assert.equal(report.delegationChainLength, 2);
    assert.equal(report.finalRelayDelegate, relayerTarget);
    assert.equal(report.relayerTargetMatches, true);
    assert.equal(report.caveatHashes.length, 2);
    assert.equal(report.lanePolicySummary.agent, "Verifier");
    assert.equal(report.lanePolicySummary.maxAmountAtoms, "2000000");
    assert.equal(report.oneShotSend, false);
    assert.equal(report.x402Settlement, false);
    assert.equal(report.mainnetSend, false);
    assert.ok(report.rootDelegatorHash.startsWith("sha256:"));
    assert.ok(logs.some((line) => line.includes("lane=VERIFIER_X402")));
  });

  it("accepts a Treasurer payout two-hop redelegation chain with a distinct caveat hash", () => {
    const verifierReport = buildA2ARedelegationProofReport({
      permissionContext: verifierRedelegatedContext,
      relayerTargetWallet: relayerTarget,
      lane: A2A_REDELEGATION_LANES.VERIFIER_X402,
    });
    const treasurerReport = buildA2ARedelegationProofReport({
      permissionContext: treasurerRedelegatedContext,
      relayerTargetWallet: relayerTarget,
      lane: A2A_REDELEGATION_LANES.TREASURER_PAYOUT,
    });

    assert.equal(treasurerReport.status, A2A_REDELEGATION_STATUS.READY);
    assert.equal(treasurerReport.publicClaimAllowed, true);
    assert.equal(treasurerReport.lanePolicySummary.agent, "Treasurer");
    assert.equal(treasurerReport.lanePolicySummary.maxAmountAtoms, "30000000");
    assert.notEqual(
      verifierReport.caveatHashes[1].caveatsHash,
      treasurerReport.caveatHashes[1].caveatsHash,
    );
  });

  it("blocks a redelegation chain whose final delegate is not the relayer target", () => {
    const report = buildA2ARedelegationProofReport({
      permissionContext: redelegatedContext,
      relayerTargetWallet: "0xffffffffffffffffffffffffffffffffffffffff",
      lane: A2A_REDELEGATION_LANES.TREASURER_PAYOUT,
    });

    assert.equal(report.status, A2A_REDELEGATION_STATUS.BLOCKED_TARGET_MISMATCH);
    assert.equal(report.publicClaimAllowed, false);
  });

  it("blocks unknown A2A lanes", () => {
    const report = buildA2ARedelegationProofReport({
      permissionContext: treasurerRedelegatedContext,
      relayerTargetWallet: relayerTarget,
      lane: "UNKNOWN_LANE",
    });

    assert.equal(report.status, A2A_REDELEGATION_STATUS.BLOCKED_LANE);
    assert.equal(report.publicClaimAllowed, false);
    assert.ok(report.issues.some((issue) => issue.includes("A2A lane must be one of")));
  });

  it("builds a public-safe summary without raw donor, master, signatures, or context", () => {
    const report = buildA2ARedelegationProofReport({
      permissionContext: verifierRedelegatedContext,
      relayerTargetWallet: relayerTarget,
      lane: A2A_REDELEGATION_LANES.VERIFIER_X402,
    });
    const summary = buildA2ARedelegationPublicSummary({
      report,
      relayerTargetIsPublic: false,
    });
    const serialized = JSON.stringify(summary);

    assert.equal(summary.finalRelayDelegate, null);
    assert.equal(summary.relayerTargetWallet, null);
    assert.equal(summary.finalRelayDelegateHash.startsWith("sha256:"), true);
    assert.equal(summary.relayerTargetWalletHash.startsWith("sha256:"), true);
    assert.equal(summary.oneShotSend, false);
    assert.equal(summary.x402Settlement, false);
    assert.equal(summary.mainnetSend, false);
    assert.equal(serialized.includes(donor), false);
    assert.equal(serialized.includes(master), false);
    assert.equal(serialized.includes("abcd"), false);
    assert.equal(serialized.includes("dcba"), false);
    assert.equal(serialized.includes(verifierRedelegatedContext), false);
  });
});
