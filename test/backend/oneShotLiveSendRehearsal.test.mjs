import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {buildOneShotEstimatePreflight} from "../../lib/oneShotEstimatePreflight.mjs";
import {
  LIVE_SEND_REHEARSAL_STATUS,
  buildOneShotLiveSendRehearsal,
  formatOneShotLiveSendRehearsalLogs,
  runOneShotLiveSendAfterRehearsal,
  selectEstimateContext,
} from "../../lib/oneShotLiveSendRehearsal.mjs";
import {buildErc20TransferExecution} from "../../lib/oneShotFeePlan.mjs";
import {ONESHOT_RELAYER_TESTNET_RPC_URL} from "../../lib/oneShot.mjs";

const permissionContext = encodeDelegations([
  {
    delegate: "0x1111111111111111111111111111111111111111",
    delegator: "0x2222222222222222222222222222222222222222",
    authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
    caveats: [
      {
        enforcer: "0x3333333333333333333333333333333333333333",
        terms: "0x",
        args: "0x",
      },
    ],
    salt: 1n,
    signature: "0xabcd",
  },
]);

const feePaymentExecution = buildErc20TransferExecution({
  token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  recipient: "0x5555555555555555555555555555555555555555",
  amount: 10_000,
});
const feePaymentPlan = {
  chainId: "84532",
  token: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
  feeCollector: "0x5555555555555555555555555555555555555555",
  mockFeeAtoms: "10000",
};
const estimateResult = {
  success: true,
  gasUsed: {"84532": "471571"},
  requiredPaymentAmount: "10000",
  context: "signed-estimate-context",
};

function buildReadyPreflight() {
  return buildOneShotEstimatePreflight({
    permissionContext,
    endpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
    liveEstimateEnabled: true,
    liveSendEnabled: false,
    relayerTargetWallet: "0x1111111111111111111111111111111111111111",
    feePaymentExecution,
    feePaymentPlan,
  });
}

describe("1Shot live send rehearsal", () => {
  it("blocks when the estimate did not succeed", () => {
    const rehearsal = buildOneShotLiveSendRehearsal({
      preflight: buildReadyPreflight(),
      estimateResult: {success: false, error: "estimate reverted"},
      feePaymentPlan,
    });

    assert.equal(rehearsal.status, LIVE_SEND_REHEARSAL_STATUS.BLOCKED);
    assert.ok(rehearsal.issues.some((issue) => issue.includes("success=true")));
  });

  it("blocks when the estimate context is missing", () => {
    const rehearsal = buildOneShotLiveSendRehearsal({
      preflight: buildReadyPreflight(),
      estimateResult: {...estimateResult, context: ""},
      feePaymentPlan,
    });

    assert.equal(rehearsal.status, LIVE_SEND_REHEARSAL_STATUS.BLOCKED);
    assert.ok(rehearsal.issues.some((issue) => issue.includes("estimate context")));
  });

  it("blocks when planned fee payment does not match the estimate", () => {
    const rehearsal = buildOneShotLiveSendRehearsal({
      preflight: buildReadyPreflight(),
      estimateResult: {...estimateResult, requiredPaymentAmount: "20000"},
      feePaymentPlan,
    });

    assert.equal(rehearsal.status, LIVE_SEND_REHEARSAL_STATUS.BLOCKED);
    assert.equal(rehearsal.feePaymentMatchesEstimate, false);
    assert.ok(rehearsal.issues.some((issue) => issue.includes("planned fee payment")));
  });

  it("builds redacted dry-run send params after a matching successful estimate", () => {
    const rehearsal = buildOneShotLiveSendRehearsal({
      preflight: buildReadyPreflight(),
      estimateResult,
      feePaymentPlan,
      liveSendEnabled: false,
    });
    const logs = formatOneShotLiveSendRehearsalLogs(rehearsal);

    assert.equal(rehearsal.status, LIVE_SEND_REHEARSAL_STATUS.READY_DRY_RUN);
    assert.equal(rehearsal.readyForNetworkSend, false);
    assert.equal(rehearsal.sendRequest.method, "relayer_send7710Transaction");
    assert.equal(rehearsal.sendParams.context, estimateResult.context);
    assert.ok(logs.some((line) => line.includes("network send is still disabled")));
    assert.ok(logs.some((line) => line.includes("estimate context hash=")));
  });

  it("runs live send only after the rehearsal gate passes", async () => {
    const rehearsal = buildOneShotLiveSendRehearsal({
      preflight: buildReadyPreflight(),
      estimateResult,
      feePaymentPlan,
      liveSendEnabled: true,
    });

    const result = await runOneShotLiveSendAfterRehearsal(rehearsal, {
      fetchImpl: async (_url, init) => {
        const request = JSON.parse(init.body);
        assert.equal(request.method, "relayer_send7710Transaction");
        assert.equal(request.params.context, estimateResult.context);
        return {
          ok: true,
          json: async () => ({jsonrpc: "2.0", id: request.id, result: {taskId: "0xabc"}}),
        };
      },
    });

    assert.deepEqual(result, {taskId: "0xabc"});
  });

  it("can select context from contextByChainId when top-level context is absent", () => {
    assert.equal(
      selectEstimateContext({contextByChainId: {"84532": "chain-context"}}, 84532),
      "chain-context",
    );
  });
});
