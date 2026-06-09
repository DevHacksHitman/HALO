import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {BASE_SEPOLIA_CHAIN_ID, HALO_PERMISSION_TYPE, createHaloPermissionRequest} from "../../lib/haloPermissions.mjs";
import {
  PERMISSION_CAPTURE_STATUS,
  buildPermissionCaptureReport,
  formatPermissionCaptureLogs,
  summarizePermissionGrant,
} from "../../lib/metaMaskPermissionCapture.mjs";

const DONOR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const DELEGATION_MANAGER = "0xcccccccccccccccccccccccccccccccccccccccc";
const FACTORY = "0xdddddddddddddddddddddddddddddddddddddddd";

const request = createHaloPermissionRequest({
  donorAddress: DONOR,
  sessionAccount: SESSION,
  nowSeconds: 1_766_000_000,
});

const grant = {
  ...request,
  chainId: "0x14a34",
  context: "0x1234abcd",
  delegationManager: DELEGATION_MANAGER,
  dependencies: [
    {
      factory: FACTORY,
      factoryData: "0x",
    },
  ],
};

describe("MetaMask permission capture inspection", () => {
  it("summarizes a captured permission grant without marking it relay-ready", () => {
    const summary = summarizePermissionGrant(grant, request);

    assert.equal(summary.source, "wallet_requestExecutionPermissions");
    assert.equal(summary.status, PERMISSION_CAPTURE_STATUS.HEX_CONTEXT_CAPTURED);
    assert.equal(summary.relayReadiness, PERMISSION_CAPTURE_STATUS.DECODE_REQUIRED);
    assert.equal(summary.liveRelayReady, false);
    assert.equal(summary.chainId, BASE_SEPOLIA_CHAIN_ID);
    assert.equal(summary.permissionType, HALO_PERMISSION_TYPE);
    assert.equal(summary.context, "0x1234abcd");
    assert.equal(summary.contextBytes, 4);
    assert.equal(summary.delegationManager, DELEGATION_MANAGER);
    assert.equal(summary.dependencies.length, 1);
    assert.equal(summary.dependencies[0].factory, FACTORY);
  });

  it("builds an auditor-readable Step 10 capture report", () => {
    const report = buildPermissionCaptureReport(grant, request);
    const logs = formatPermissionCaptureLogs(report);

    assert.equal(report.step, 10);
    assert.equal(report.verdict, "CONDITIONAL_GO_CAPTURED_CONTEXT_ONLY");
    assert.equal(report.summary.liveRelayReady, false);
    assert.ok(report.noGoFor.includes("live_1shot_send"));
    assert.ok(report.safety.some((line) => line.includes("hex-encoded")));
    assert.ok(logs.some((line) => line.includes("decoded delegation array still required")));
  });

  it("rejects malformed grants before they reach 1Shot", () => {
    assert.throws(() => summarizePermissionGrant({...grant, context: "0x123"}), /context/);
    assert.throws(() => summarizePermissionGrant({...grant, delegationManager: "0x123"}), /delegationManager/);
    assert.throws(() => summarizePermissionGrant({...grant, dependencies: {}}), /dependencies/);
    assert.throws(
      () =>
        summarizePermissionGrant({
          ...grant,
          dependencies: [{factory: FACTORY, factoryData: "not-hex"}],
        }),
      /factoryData/,
    );
  });
});
