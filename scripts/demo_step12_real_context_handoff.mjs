import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {buildUsdcTransferExecution} from "../lib/haloAgentBridge.mjs";
import {buildPermissionCaptureReport} from "../lib/metaMaskPermissionCapture.mjs";
import {
  buildPermissionContextHandoff,
  formatPermissionContextHandoffLogs,
} from "../lib/metaMaskPermissionHandoff.mjs";
import {buildBaseSepoliaEstimateRequestFromPermissionContext} from "../lib/metaMaskPermissionDecoder.mjs";

const permissionContext =
  process.env.HALO_METAMASK_PERMISSION_CONTEXT ||
  encodeDelegations([
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

const capturedGrant = {
  chainId: "0x14a34",
  context: permissionContext,
  delegationManager: "0xcccccccccccccccccccccccccccccccccccccccc",
  dependencies: [
    {
      factory: "0xdddddddddddddddddddddddddddddddddddddddd",
      factoryData: "0x",
    },
  ],
  permission: {
    type: "erc20-token-periodic",
  },
};

const captureReport = buildPermissionCaptureReport(capturedGrant, capturedGrant);
const handoff = buildPermissionContextHandoff(captureReport);

for (const line of formatPermissionContextHandoffLogs(handoff)) {
  console.log(line);
}

const execution = buildUsdcTransferExecution({
  usdcToken: process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  recipient: "0x4444444444444444444444444444444444444444",
  amount: 25_000_000,
});
const estimateReport = buildBaseSepoliaEstimateRequestFromPermissionContext({
  permissionContext: handoff.context,
  executions: [execution],
  destinationUrl: "https://example.com/api/webhooks/1shot",
  requestId: 12,
});

console.log("");
console.log("[HALO] Step 12 handoff report:");
console.log(
  JSON.stringify(
    {
      step: handoff.step,
      verdict: handoff.verdict,
      contextPreview: handoff.contextPreview,
      contextBytes: handoff.contextBytes,
      redactedShellCommand: handoff.redactedShellCommand,
      decodedDelegations: estimateReport.decoded.delegationCount,
      decodedCaveats: estimateReport.decoded.caveatCount,
      estimateMethod: estimateReport.request.method,
      publicRecordingRule: handoff.publicRecordingRule,
    },
    null,
    2,
  ),
);

console.log("");
console.log("[NEXT] private full-context command to be run locally.");
