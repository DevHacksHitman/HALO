import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {buildUsdcTransferExecution} from "../../lib/haloAgentBridge.mjs";
import {
  BASE_SEPOLIA_CHAIN_ID,
  buildBaseSepoliaEstimateRequestFromPermissionContext,
  decodeMetaMaskPermissionContext,
} from "../../lib/metaMaskPermissionDecoder.mjs";

const decodedDelegations = [
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
];

const encodedContext = encodeDelegations(decodedDelegations);
const usdcToken = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

describe("MetaMask permission context decoder", () => {
  it("decodes MetaMask permission context into a 1Shot-ready delegation array", () => {
    const report = decodeMetaMaskPermissionContext(encodedContext);

    assert.equal(report.delegationCount, 1);
    assert.equal(report.caveatCount, 1);
    assert.equal(report.relayReady, true);
    assert.equal(report.reencodeMatches, true);
    assert.equal(report.permissionContext[0].delegate, decodedDelegations[0].delegate);
    assert.equal(report.permissionContext[0].salt, "0x1");
  });

  it("builds a Base Sepolia 1Shot estimate request from decoded permission context", () => {
    const execution = buildUsdcTransferExecution({
      usdcToken,
      recipient: "0x4444444444444444444444444444444444444444",
      amount: 25_000_000,
    });
    const report = buildBaseSepoliaEstimateRequestFromPermissionContext({
      permissionContext: encodedContext,
      executions: [execution],
      destinationUrl: "https://example.com/api/webhooks/1shot",
      memo: "Halo Step 11 estimate",
      requestId: 11,
    });

    assert.equal(report.chainId, BASE_SEPOLIA_CHAIN_ID);
    assert.equal(report.liveSendEnabled, false);
    assert.equal(report.request.method, "relayer_estimate7710Transaction");
    assert.equal(report.request.id, 11);
    assert.equal(report.params.chainId, "84532");
    assert.equal(report.params.transactions[0].executions[0].target, usdcToken.toLowerCase());
    assert.equal(report.params.transactions[0].permissionContext[0].salt, "0x1");
  });

  it("rejects malformed encoded permission context before estimate construction", () => {
    assert.throws(
      () =>
        buildBaseSepoliaEstimateRequestFromPermissionContext({
          permissionContext: "0x1234",
          executions: [],
        }),
      /could not be decoded as MetaMask delegations/,
    );
  });
});
