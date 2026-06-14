import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {decodeErc20Transfer} from "../../lib/erc20.mjs";
import {
  adjustOneShotFeePaymentPlanAmount,
  buildErc20TransferExecution,
  fetchOneShotFeePaymentPlan,
  selectCapability,
  selectCapabilityToken,
} from "../../lib/oneShotFeePlan.mjs";
import {BASE_MAINNET_USDC_ADDRESS} from "../../lib/chainProfiles.mjs";

const chainId = 84532;
const token = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const targetAddress = "0xf1ef956eff4181Ce913b664713515996858B9Ca9";
const feeCollector = "0x5555555555555555555555555555555555555555";

describe("1Shot fee payment plan", () => {
  it("fetches capabilities and fee data, then builds a USDC fee execution", async () => {
    const calls = [];
    const plan = await fetchOneShotFeePaymentPlan({
      chainId,
      token,
      mockFeeUsdc: "10",
      fetchImpl: async (_url, init) => {
        const request = JSON.parse(init.body);
        calls.push(request);
        if (request.method === "relayer_getCapabilities") {
          return jsonResponse({
            [String(chainId)]: {
              targetAddress,
              feeCollector,
              tokens: [{address: token, symbol: "USDC", decimals: 6}],
            },
          });
        }
        if (request.method === "relayer_getFeeData") {
          return jsonResponse({minFee: "4.5", context: "fee-context"});
        }
        throw new Error(`unexpected method ${request.method}`);
      },
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "relayer_getCapabilities");
    assert.deepEqual(calls[0].params, ["84532"]);
    assert.equal(calls[1].method, "relayer_getFeeData");
    assert.equal(calls[1].params.chainId, "84532");
    assert.equal(calls[1].params.token, token.toLowerCase());
    assert.equal(plan.targetAddress, targetAddress.toLowerCase());
    assert.equal(plan.feeCollector, feeCollector);
    assert.equal(plan.minFeeAtoms, "4500000");
    assert.equal(plan.mockFeeAtoms, "10000000");
    assert.equal(plan.contextPresent, true);
    assert.equal(plan.execution.target, token.toLowerCase());
    assert.deepEqual(decodeErc20Transfer(plan.execution.data), {
      recipient: feeCollector,
      amount: "10000000",
    });
  });

  it("selects Base mainnet chain, relayer, and native USDC from the chain profile", async () => {
    const calls = [];
    const plan = await fetchOneShotFeePaymentPlan({
      chainProfile: "base-mainnet",
      mockFeeUsdc: "0.50",
      fetchImpl: async (url, init) => {
        const request = JSON.parse(init.body);
        calls.push({url, request});
        if (request.method === "relayer_getCapabilities") {
          return jsonResponse({
            "8453": {
              targetAddress,
              feeCollector,
              tokens: [{address: BASE_MAINNET_USDC_ADDRESS, symbol: "USDC", decimals: 6}],
            },
          });
        }
        if (request.method === "relayer_getFeeData") {
          return jsonResponse({minFee: "0.01", context: "fee-context"});
        }
        throw new Error(`unexpected method ${request.method}`);
      },
    });

    assert.equal(plan.chainProfile, "base-mainnet");
    assert.equal(plan.chainId, "8453");
    assert.equal(plan.token, BASE_MAINNET_USDC_ADDRESS.toLowerCase());
    assert.equal(calls[0].url, "https://relayer.1shotapi.com/relayers");
    assert.deepEqual(calls[0].request.params, ["8453"]);
  });

  it("prefers HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC over the legacy mock fee env", async () => {
    const previousInitial = process.env.HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC;
    const previousMock = process.env.HALO_ONESHOT_ESTIMATE_MOCK_FEE_USDC;
    process.env.HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC = "0.25";
    process.env.HALO_ONESHOT_ESTIMATE_MOCK_FEE_USDC = "0.01";
    try {
      const plan = await fetchOneShotFeePaymentPlan({
        chainId,
        token,
        fetchImpl: async (_url, init) => {
          const request = JSON.parse(init.body);
          if (request.method === "relayer_getCapabilities") {
            return jsonResponse({
              [String(chainId)]: {
                targetAddress,
                feeCollector,
                tokens: [{address: token, symbol: "USDC", decimals: 6}],
              },
            });
          }
          if (request.method === "relayer_getFeeData") {
            return jsonResponse({minFee: "0.01", context: "fee-context"});
          }
          throw new Error(`unexpected method ${request.method}`);
        },
      });

      assert.equal(plan.initialFeeAtoms, "250000");
      assert.equal(plan.mockFeeAtoms, "250000");
      assert.equal(plan.initialFeeUsdc, "0.25");
    } finally {
      if (previousInitial === undefined) {
        delete process.env.HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC;
      } else {
        process.env.HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC = previousInitial;
      }
      if (previousMock === undefined) {
        delete process.env.HALO_ONESHOT_ESTIMATE_MOCK_FEE_USDC;
      } else {
        process.env.HALO_ONESHOT_ESTIMATE_MOCK_FEE_USDC = previousMock;
      }
    }
  });

  it("rejects capabilities that do not support the requested token", () => {
    assert.throws(
      () => selectCapabilityToken({tokens: [{address: "0x1111111111111111111111111111111111111111"}]}, token),
      /did not include token/,
    );
  });

  it("builds standalone ERC20 transfer executions", () => {
    const execution = buildErc20TransferExecution({token, recipient: feeCollector, amount: 1});

    assert.equal(execution.target, token.toLowerCase());
    assert.equal(execution.value, "0x0");
    assert.equal(decodeErc20Transfer(execution.data).amount, "1");
  });

  it("adjusts the fee execution to the estimate required payment amount", () => {
    const plan = {
      chainId: "84532",
      token: token.toLowerCase(),
      tokenDecimals: 6,
      feeCollector,
      mockFeeAtoms: "10000",
      execution: buildErc20TransferExecution({token, recipient: feeCollector, amount: 10_000}),
    };
    const adjusted = adjustOneShotFeePaymentPlanAmount(plan, "11966");

    assert.equal(adjusted.mockFeeAtoms, "11966");
    assert.equal(adjusted.mockFeeUsdc, "0.011966");
    assert.equal(adjusted.adjustedToRequiredPaymentAmount, true);
    assert.deepEqual(decodeErc20Transfer(adjusted.execution.data), {
      recipient: feeCollector,
      amount: "11966",
    });
  });

  it("selects chain capabilities from keyed maps", () => {
    const capability = selectCapability({[String(chainId)]: {targetAddress}}, chainId);

    assert.equal(capability.targetAddress, targetAddress);
  });
});

function jsonResponse(result) {
  return {
    ok: true,
    json: async () => ({jsonrpc: "2.0", id: 1, result}),
  };
}
