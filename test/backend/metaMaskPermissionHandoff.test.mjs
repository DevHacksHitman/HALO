import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  buildPermissionContextHandoff,
  formatPermissionContextHandoffLogs,
  redactPermissionCaptureForDisplay,
} from "../../lib/metaMaskPermissionHandoff.mjs";

const captureReport = {
  step: 10,
  summary: {
    context:
      "0x00000000000000000000000000000000000000000000000000000000000000201234abcd",
  },
};

describe("MetaMask permission context handoff", () => {
  it("builds a private shell command and redacted public command", () => {
    const handoff = buildPermissionContextHandoff(captureReport);

    assert.equal(handoff.step, 12);
    assert.equal(handoff.contextEnvVar, "HALO_METAMASK_PERMISSION_CONTEXT");
    assert.ok(handoff.shellCommand.includes(captureReport.summary.context));
    assert.ok(!handoff.redactedShellCommand.includes(captureReport.summary.context));
    assert.ok(handoff.redactedShellCommand.includes("scripts/demo_step16_real_permission_estimate.sh"));
    assert.equal(handoff.liveEstimateEnabled, false);
  });

  it("redacts full context for display while preserving the preview", () => {
    const handoff = buildPermissionContextHandoff(captureReport);
    const display = redactPermissionCaptureForDisplay(captureReport, handoff);

    assert.equal(display.summary.context, handoff.contextPreview);
    assert.equal(display.summary.contextRedacted, true);
    assert.equal(display.handoff.redactedShellCommand, handoff.redactedShellCommand);
    assert.equal(display.handoff.liveEstimateEnabled, false);
  });

  it("formats recording-safe handoff logs", () => {
    const handoff = buildPermissionContextHandoff(captureReport);
    const logs = formatPermissionContextHandoffLogs(handoff);

    assert.ok(logs.some((line) => line.includes("redacted context only")));
    assert.ok(logs.some((line) => line.includes("Live estimate/send remain disabled")));
  });

  it("rejects malformed handoff context", () => {
    assert.throws(
      () => buildPermissionContextHandoff({summary: {context: "0x123"}}),
      /permission context handoff must be 0x-prefixed byte data/,
    );
  });
});
