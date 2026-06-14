import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {decodeErc20Transfer, ERC20_TRANSFER_SELECTOR} from "../../lib/erc20.mjs";
import {
  prepareTreasurerGrantRelay,
  prepareVerifierX402Relay,
} from "../../lib/haloAgentBridge.mjs";

const chainId = 84532;
const usdcToken = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const venicePaymaster = "0xcccccccccccccccccccccccccccccccccccccccc";
const requester = "0xdddddddddddddddddddddddddddddddddddddddd";
const permissionContext = [
  {
    delegate: "0x1111111111111111111111111111111111111111",
    delegator: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    authority: "0x0000000000000000000000000000000000000000",
    caveats: [
      {
        enforcer: "0x3333333333333333333333333333333333333333",
        terms: "0x",
        args: "0x",
      },
    ],
    salt: "0x1",
    signature: "0xabcd",
  },
];

describe("Halo backend bridge", () => {
  it("prepares a verifier x402 relay draft against the USDC target", () => {
    const draft = prepareVerifierX402Relay({
      chainId,
      usdcToken,
      venicePaymaster,
      feeAmount: 2_000_000,
      permissionContext,
    });

    assert.equal(draft.kind, "VERIFIER_X402_PAYMENT");
    assert.equal(draft.execution.target, usdcToken);
    assert.equal(draft.execution.value, "0x0");
    assert.ok(draft.execution.data.startsWith(ERC20_TRANSFER_SELECTOR));
    assert.deepEqual(decodeErc20Transfer(draft.execution.data), {
      recipient: venicePaymaster,
      amount: "2000000",
    });
    assert.equal(draft.request.method, "relayer_send7710Transaction");
    assert.equal(draft.request.params.chainId, "84532");
    assert.equal(draft.request.params.transactions[0].permissionContext[0].delegate, permissionContext[0].delegate);
    assert.equal(draft.request.params.transactions[0].executions[0].target, usdcToken);
    assert.ok(draft.logs.some((line) => line.startsWith("[x402]")));
    assert.ok(draft.logs.some((line) => line.startsWith("[1Shot]")));
  });

  it("prepares a treasurer payout relay draft against the USDC target", () => {
    const draft = prepareTreasurerGrantRelay({
      chainId,
      usdcToken,
      requester,
      grantAmount: "25000000",
      permissionContext,
    });

    assert.equal(draft.kind, "TREASURER_GRANT_PAYOUT");
    assert.equal(draft.execution.target, usdcToken);
    assert.deepEqual(draft.transfer, {
      recipient: requester,
      amount: "25000000",
    });
    assert.equal(draft.request.params.memo, undefined);
    assert.ok(draft.logs.some((line) => line.startsWith("[TREASURER]")));
  });

  it("rejects verifier payments above the x402 fee cap", () => {
    assert.throws(
      () =>
        prepareVerifierX402Relay({
          chainId,
          usdcToken,
          venicePaymaster,
          feeAmount: 2_000_001,
          permissionContext,
        }),
      /feeAmount exceeds cap/,
    );
  });

  it("rejects treasurer payouts above the grant cap", () => {
    assert.throws(
      () =>
        prepareTreasurerGrantRelay({
          chainId,
          usdcToken,
          requester,
          grantAmount: 30_000_001,
          permissionContext,
        }),
      /grantAmount exceeds cap/,
    );
  });

  it("rejects invalid addresses before drafting a relayer request", () => {
    assert.throws(
      () =>
        prepareVerifierX402Relay({
          chainId,
          usdcToken: "0x1234",
          venicePaymaster,
          feeAmount: 1,
          permissionContext,
        }),
      /usdcToken must be a 20-byte hex address/,
    );
  });

  it("rejects missing decoded permission context before drafting a 1Shot request", () => {
    assert.throws(
      () =>
        prepareTreasurerGrantRelay({
          chainId,
          usdcToken,
          requester,
          grantAmount: 1,
        }),
      /permissionContext must contain at least one delegation/,
    );
  });
});
