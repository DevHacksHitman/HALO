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
import {ONESHOT_RELAYER_MAINNET_RPC_URL, ONESHOT_RELAYER_TESTNET_RPC_URL} from "../../lib/oneShot.mjs";
import {BASE_MAINNET_USDC_ADDRESS} from "../../lib/chainProfiles.mjs";

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
const mainnetPermissionGrantJson = JSON.stringify({
  context: permissionContext,
  authorizationList: [
    {
      chainId: 8453,
      address: "0x5555555555555555555555555555555555555555",
      nonce: "0x1",
      yParity: 0,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    },
  ],
});

function buildReadyPreflight({destinationUrl = "https://halo-webhook.ngrok.app/api/webhooks/1shot"} = {}) {
  return buildOneShotEstimatePreflight({
    permissionContext,
    endpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
    liveEstimateEnabled: true,
    liveSendEnabled: false,
    relayerTargetWallet: "0x1111111111111111111111111111111111111111",
    feePaymentExecution,
    feePaymentPlan,
    destinationUrl,
  });
}

function buildReadyMainnetPreflight({destinationUrl = "https://halo-webhook.ngrok.app/api/webhooks/1shot"} = {}) {
  return buildOneShotEstimatePreflight({
    permissionContext: "",
    permissionGrantJson: mainnetPermissionGrantJson,
    chainProfile: "base-mainnet",
    endpoint: ONESHOT_RELAYER_MAINNET_RPC_URL,
    liveEstimateEnabled: true,
    liveSendEnabled: false,
    relayerTargetWallet: "0x1111111111111111111111111111111111111111",
    feePaymentExecution: buildErc20TransferExecution({
      token: BASE_MAINNET_USDC_ADDRESS,
      recipient: "0x5555555555555555555555555555555555555555",
      amount: 10_000,
    }),
    feePaymentPlan: {...feePaymentPlan, chainId: "8453", token: BASE_MAINNET_USDC_ADDRESS.toLowerCase()},
    usdcToken: BASE_MAINNET_USDC_ADDRESS,
    amount: 1_000_000,
    destinationUrl,
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
    assert.equal(rehearsal.sendParams.memo, undefined);
    assert.ok(logs.some((line) => line.includes("network send is still disabled")));
    assert.ok(logs.some((line) => line.includes("estimate context hash=")));
  });

  it("blocks live send when the webhook URL is still the dry-run placeholder", () => {
    const rehearsal = buildOneShotLiveSendRehearsal({
      preflight: buildReadyPreflight({destinationUrl: "https://example.com/api/webhooks/1shot"}),
      estimateResult,
      feePaymentPlan,
      liveSendEnabled: true,
    });

    assert.equal(rehearsal.status, LIVE_SEND_REHEARSAL_STATUS.BLOCKED);
    assert.equal(rehearsal.webhookUrlReadyForLiveSend, false);
    assert.ok(rehearsal.issues.some((issue) => issue.includes("placeholder host example.com")));
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

  it("blocks Base mainnet live send until HALO_MAINNET_DEMO_ARMED is set", () => {
    const previous = process.env.HALO_MAINNET_DEMO_ARMED;
    delete process.env.HALO_MAINNET_DEMO_ARMED;
    try {
      const rehearsal = buildOneShotLiveSendRehearsal({
        preflight: buildReadyMainnetPreflight(),
        estimateResult: {...estimateResult, gasUsed: {"8453": "471571"}},
        feePaymentPlan,
        liveSendEnabled: true,
      });

      assert.equal(rehearsal.status, LIVE_SEND_REHEARSAL_STATUS.BLOCKED);
      assert.equal(rehearsal.chainProfile, "base-mainnet");
      assert.equal(rehearsal.mainnetReadiness.ready, false);
      assert.ok(rehearsal.issues.some((issue) => issue.includes("HALO_MAINNET_DEMO_ARMED")));
    } finally {
      if (previous === undefined) {
        delete process.env.HALO_MAINNET_DEMO_ARMED;
      } else {
        process.env.HALO_MAINNET_DEMO_ARMED = previous;
      }
    }
  });

  it("allows Base mainnet send params only after arming and caps pass", () => {
    const previous = process.env.HALO_MAINNET_DEMO_ARMED;
    process.env.HALO_MAINNET_DEMO_ARMED = "1";
    try {
      const rehearsal = buildOneShotLiveSendRehearsal({
        preflight: buildReadyMainnetPreflight(),
        estimateResult: {...estimateResult, gasUsed: {"8453": "471571"}},
        feePaymentPlan,
        liveSendEnabled: true,
      });

      assert.equal(rehearsal.status, LIVE_SEND_REHEARSAL_STATUS.READY_LIVE_SEND);
      assert.equal(rehearsal.mainnetReadiness.status, "CONDITIONAL_GO_MAINNET_ARMED");
      assert.equal(rehearsal.sendParams.chainId, "8453");
    } finally {
      if (previous === undefined) {
        delete process.env.HALO_MAINNET_DEMO_ARMED;
      } else {
        process.env.HALO_MAINNET_DEMO_ARMED = previous;
      }
    }
  });

  it("can select context from contextByChainId when top-level context is absent", () => {
    assert.equal(
      selectEstimateContext({contextByChainId: {"84532": "chain-context"}}, 84532),
      "chain-context",
    );
  });
});
