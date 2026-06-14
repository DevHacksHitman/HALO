import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {getSmartAccountsEnvironment} from "@metamask/smart-accounts-kit";

import {
  SMART_ACCOUNT_7702_STATUS,
  classifySmartAccount7702Readiness,
  getAccountCode7702Readiness,
} from "../../lib/metaMask7702Readiness.mjs";

const delegator = "0x5555555555555555555555555555555555555555";
const eip7702Code = `0xef0100${delegator.slice(2)}`;
const baseMainnetDelegator = getSmartAccountsEnvironment(8453).implementations.EIP7702StatelessDeleGatorImpl;
const baseMainnetCode = `0xef0100${baseMainnetDelegator.slice(2)}`;

describe("MetaMask 7702 readiness", () => {
  it("accepts account code delegated to the expected stateless delegator", () => {
    const report = classifySmartAccount7702Readiness({
      accountCode: eip7702Code,
      expectedDelegatorAddress: delegator,
    });

    assert.equal(report.status, SMART_ACCOUNT_7702_STATUS.READY_EXPECTED_DELEGATOR);
    assert.equal(report.readyForLiveSend, true);
    assert.equal(report.eip7702Delegator, delegator);
  });

  it("uses the Smart Accounts Kit expected EIP-7702 delegator for a chain id", () => {
    const report = classifySmartAccount7702Readiness({
      accountCode: baseMainnetCode,
      chainId: 8453,
    });

    assert.equal(report.status, SMART_ACCOUNT_7702_STATUS.READY_EXPECTED_DELEGATOR);
    assert.equal(report.expectedDelegator, baseMainnetDelegator.toLowerCase());
  });

  it("blocks when deployed 7702 code points to an unexpected implementation", () => {
    const report = classifySmartAccount7702Readiness({
      accountCode: eip7702Code,
      expectedDelegatorAddress: "0x6666666666666666666666666666666666666666",
    });

    assert.equal(report.status, SMART_ACCOUNT_7702_STATUS.BLOCKED_UNEXPECTED_DELEGATOR);
    assert.equal(report.readyForLiveSend, false);
    assert.ok(report.issues.some((issue) => issue.includes("does not match")));
  });

  it("accepts a single wallet-supplied authorizationList when no code is present", () => {
    const report = classifySmartAccount7702Readiness({
      accountCode: "0x",
      authorizationList: [{chainId: 8453}],
    });

    assert.equal(report.status, SMART_ACCOUNT_7702_STATUS.READY_AUTHORIZATION_LIST);
    assert.equal(report.readyForLiveSend, true);
  });

  it("blocks live send when no code, authorizationList, or dependency path exists", () => {
    const report = classifySmartAccount7702Readiness({accountCode: "0x"});

    assert.equal(report.status, SMART_ACCOUNT_7702_STATUS.BLOCKED_NO_PATH);
    assert.equal(report.readyForLiveSend, false);
  });

  it("queries account code through a viem-compatible public client", async () => {
    const report = await getAccountCode7702Readiness({
      publicClient: {
        getCode: async ({address}) => {
          assert.equal(address, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
          return eip7702Code;
        },
      },
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectedDelegatorAddress: delegator,
    });

    assert.equal(report.status, SMART_ACCOUNT_7702_STATUS.READY_EXPECTED_DELEGATOR);
  });
});
