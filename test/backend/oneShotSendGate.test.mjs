import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {
  SEND_GATE_STATUS,
  buildOneShotSendGate,
  formatOneShotSendGateLogs,
  parseEstimateResult,
  runOneShotSendAfterGate,
} from "../../lib/oneShotSendGate.mjs";
import {
  ONESHOT_RELAYER_MAINNET_RPC_URL,
  ONESHOT_RELAYER_TESTNET_RPC_URL,
} from "../../lib/oneShot.mjs";

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
const estimateResult = {gas: "0x1234", fee: "0x10"};

describe("1Shot capped send gate", () => {
  it("blocks when context or estimate result is missing", () => {
    const gate = buildOneShotSendGate({permissionContext: "", estimateResult: ""});

    assert.equal(gate.status, SEND_GATE_STATUS.BLOCKED);
    assert.ok(gate.issues.some((issue) => issue.includes("HALO_METAMASK_PERMISSION_CONTEXT")));
    assert.ok(gate.issues.some((issue) => issue.includes("HALO_ONESHOT_ESTIMATE_RESULT")));
  });

  it("builds a dry-run send request after context and estimate receipt exist", () => {
    const gate = buildOneShotSendGate({permissionContext, estimateResult});

    assert.equal(gate.status, SEND_GATE_STATUS.READY_DRY_RUN);
    assert.equal(gate.readyForNetworkSend, false);
    assert.equal(gate.sendRequest.method, "relayer_send7710Transaction");
    assert.equal(gate.grantAmountAtoms, "25000000");
  });

  it("blocks grants above the treasurer cap", () => {
    const gate = buildOneShotSendGate({
      permissionContext,
      estimateResult,
      amount: 31_000_000,
    });

    assert.equal(gate.status, SEND_GATE_STATUS.BLOCKED);
    assert.ok(gate.issues.some((issue) => issue.includes("grantAmount exceeds cap")));
  });

  it("blocks mainnet relayer endpoint unless explicitly allowed", () => {
    const gate = buildOneShotSendGate({
      permissionContext,
      estimateResult,
      endpoint: ONESHOT_RELAYER_MAINNET_RPC_URL,
    });

    assert.equal(gate.status, SEND_GATE_STATUS.BLOCKED);
    assert.ok(gate.issues.some((issue) => issue.includes("mainnet")));
  });

  it("runs live send only after the send gate passes", async () => {
    const gate = buildOneShotSendGate({
      permissionContext,
      estimateResult,
      endpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
      liveSendEnabled: true,
    });

    const result = await runOneShotSendAfterGate(gate, {
      fetchImpl: async (_url, init) => {
        const request = JSON.parse(init.body);
        assert.equal(request.method, "relayer_send7710Transaction");
        return {
          ok: true,
          json: async () => ({jsonrpc: "2.0", id: request.id, result: {taskId: "0xabc"}}),
        };
      },
    });

    assert.deepEqual(result, {taskId: "0xabc"});
  });

  it("parses estimate result JSON and formats recording-safe logs", () => {
    assert.deepEqual(parseEstimateResult(JSON.stringify(estimateResult)), estimateResult);

    const gate = buildOneShotSendGate({permissionContext, estimateResult});
    const logs = formatOneShotSendGateLogs(gate);

    assert.ok(logs.some((line) => line.includes("estimate receipt present=true")));
    assert.ok(logs.some((line) => line.includes("network send is still disabled")));
  });
});
