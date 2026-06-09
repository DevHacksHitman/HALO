import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
  HALO_PERMISSION_TYPE,
  MONTH_SECONDS,
  createHaloPermissionRequest,
  createSerializableHaloPermissionRequest,
  parseDecimalToAtoms,
  toHexQuantity,
} from "../../lib/haloPermissions.mjs";

const DONOR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("Halo MetaMask permission request", () => {
  it("builds a scoped ERC-20 periodic permission for Base Sepolia USDC", () => {
    const request = createHaloPermissionRequest({
      donorAddress: DONOR,
      sessionAccount: SESSION,
      nowSeconds: 1_766_000_000,
    });

    assert.equal(request.chainId, BASE_SEPOLIA_CHAIN_ID);
    assert.equal(request.from, DONOR);
    assert.equal(request.to, SESSION);
    assert.equal(request.expiry, 1_768_592_000);
    assert.equal(request.permission.type, HALO_PERMISSION_TYPE);
    assert.equal(request.permission.isAdjustmentAllowed, true);
    assert.equal(request.permission.data.tokenAddress, BASE_SEPOLIA_USDC_ADDRESS);
    assert.equal(request.permission.data.periodAmount, 100_000_000n);
    assert.equal(request.permission.data.periodDuration, MONTH_SECONDS);
  });

  it("serializes bigint permission amounts into hex quantities for RPC display", () => {
    const request = createSerializableHaloPermissionRequest({
      donorAddress: DONOR,
      sessionAccount: SESSION,
      nowSeconds: 1_766_000_000,
    });

    assert.equal(request.permission.data.periodAmount, "0x5f5e100");
  });

  it("parses USDC decimals without floating point math", () => {
    assert.equal(parseDecimalToAtoms("2.50"), 2_500_000n);
    assert.equal(parseDecimalToAtoms("0.000001"), 1n);
    assert.equal(toHexQuantity(2_500_000n), "0x2625a0");
  });

  it("rejects unsafe addresses and over-precise USDC amounts", () => {
    assert.throws(() => {
      createHaloPermissionRequest({donorAddress: "0x123", sessionAccount: SESSION});
    }, /donorAddress/);

    assert.throws(() => {
      createHaloPermissionRequest({donorAddress: DONOR, sessionAccount: "0x123"});
    }, /sessionAccount/);

    assert.throws(() => parseDecimalToAtoms("0.0000001"), /more than 6 decimals/);
  });
});
