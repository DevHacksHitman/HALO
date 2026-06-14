import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_ONESHOT_RELAYER_RPC_URL,
  ONESHOT_RELAYER_TESTNET_RPC_URL,
  buildEstimate7710Request,
  buildGetCapabilitiesRequest,
  buildGetFeeDataRequest,
  buildGetStatusRequest,
  buildOneShotHeaders,
  buildOneShot7710Params,
  buildSend7710Request,
  estimateOneShot7710Transaction,
  sendOneShot7710Transaction,
} from "../../lib/oneShot.mjs";

const permissionContext = [
  {
    delegate: "0x1111111111111111111111111111111111111111",
    delegator: "0x2222222222222222222222222222222222222222",
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

const execution = {
  target: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  value: "0x0",
  data: "0xa9059cbb",
};

describe("1Shot public relayer payloads", () => {
  it("defaults to the 1Shot testnet relayer unless explicitly configured", () => {
    assert.equal(DEFAULT_ONESHOT_RELAYER_RPC_URL, ONESHOT_RELAYER_TESTNET_RPC_URL);
  });

  it("builds current OpenRPC 7710 send params", () => {
    const params = buildOneShot7710Params({
      chainId: 84532,
      permissionContext,
      executions: [execution],
      context: '{"quote":"signed"}',
      destinationUrl: "https://example.com/webhooks/1shot",
      memo: "Halo test send",
    });

    assert.equal(params.chainId, "84532");
    assert.equal(params.context, '{"quote":"signed"}');
    assert.equal(params.memo, undefined);
    assert.equal(params.transactions.length, 1);
    assert.deepEqual(
      params.transactions[0].permissionContext,
      permissionContext,
    );
    assert.deepEqual(params.transactions[0].executions, [
      {
        ...execution,
        target: execution.target.toLowerCase(),
      },
    ]);
  });

  it("uses JSON-RPC params without the old single-element wrapper", () => {
    const params = buildOneShot7710Params({
      chainId: 84532,
      permissionContext,
      executions: [execution],
    });
    const request = buildSend7710Request(params);

    assert.equal(request.method, "relayer_send7710Transaction");
    assert.equal(Array.isArray(request.params), false);
    assert.equal(
      request.params.transactions[0].executions[0].target,
      execution.target.toLowerCase(),
    );
  });

  it("builds capability, fee, estimate, and status requests", () => {
    assert.deepEqual(buildGetCapabilitiesRequest([84532]).params, ["84532"]);

    assert.deepEqual(
      buildGetFeeDataRequest({ chainId: 84532, token: execution.target })
        .params,
      {
        chainId: "84532",
        token: execution.target.toLowerCase(),
      },
    );

    const params = buildOneShot7710Params({
      chainId: 84532,
      permissionContext,
      executions: [execution],
    });
    assert.equal(
      buildEstimate7710Request(params).method,
      "relayer_estimate7710Transaction",
    );
    assert.deepEqual(
      buildGetStatusRequest({
        taskId:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        logs: true,
      }).params,
      {
        id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        logs: true,
      },
    );
  });

  it("rejects encoded MetaMask context until it is decoded to a delegation array", () => {
    assert.throws(
      () =>
        buildOneShot7710Params({
          chainId: 84532,
          permissionContext: "0x1234",
          executions: [execution],
        }),
      /decoded 7710 delegation array/,
    );
  });

  it("blocks live send unless explicitly enabled", async () => {
    const params = buildOneShot7710Params({
      chainId: 84532,
      permissionContext,
      executions: [execution],
    });

    await assert.rejects(
      () =>
        sendOneShot7710Transaction(params, {
          fetchImpl: async () => {
            throw new Error("should not call network");
          },
        }),
      /live 1Shot send disabled/,
    );
  });

  it("adds optional API auth and reports fetch diagnostics", async () => {
    assert.deepEqual(buildOneShotHeaders("secret"), {
      "Content-Type": "application/json",
      Authorization: "Bearer secret",
    });

    const params = buildOneShot7710Params({
      chainId: 84532,
      permissionContext,
      executions: [execution],
    });

    await assert.rejects(
      () => estimateOneShot7710Transaction(params, {
        endpoint: "https://relayer.1shotapi.dev/relayers",
        fetchImpl: async () => {
          const error = new Error("fetch failed");
          error.cause = {code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND relayer.1shotapi.dev"};
          throw error;
        },
      }),
      /1Shot fetch failed.*ENOTFOUND/,
    );
  });
});
