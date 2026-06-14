import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {buildUsdcTransferExecution} from "../lib/haloAgentBridge.mjs";
import {
  buildBaseSepoliaEstimateRequestFromPermissionContext,
  formatDecodedPermissionEstimateLogs,
} from "../lib/metaMaskPermissionDecoder.mjs";
import {estimateOneShot7710Transaction} from "../lib/oneShot.mjs";

const hasRealPermissionContext = Boolean(process.env.HALO_METAMASK_PERMISSION_CONTEXT);
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

const execution = buildUsdcTransferExecution({
  usdcToken: process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  recipient: "0x4444444444444444444444444444444444444444",
  amount: 25_000_000,
});

const report = buildBaseSepoliaEstimateRequestFromPermissionContext({
  permissionContext,
  executions: [execution],
  destinationUrl: "https://example.com/api/webhooks/1shot",
  requestId: 11,
});

for (const line of formatDecodedPermissionEstimateLogs(report)) {
  console.log(line);
}

console.log("");
console.log("[EVM] execution target=" + report.params.transactions[0].executions[0].target);
console.log("[EVM] execution data=" + report.params.transactions[0].executions[0].data);

console.log("");
console.log("[1Shot] Base Sepolia estimate request:");
console.log(JSON.stringify(report.request, null, 2));

console.log("");
if (process.env.HALO_ONESHOT_ESTIMATE_LIVE === "1") {
  if (!hasRealPermissionContext) {
    throw new Error("live 1Shot estimate requires HALO_METAMASK_PERMISSION_CONTEXT from a real wallet grant");
  }

  console.log("[1Shot] Running live estimate with real wallet context...");
  const result = await estimateOneShot7710Transaction(report.params, {id: 11});
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("[1Shot] Live estimate not called. Set HALO_METAMASK_PERMISSION_CONTEXT and HALO_ONESHOT_ESTIMATE_LIVE=1 only after approval.");
}

console.log("");
console.log("[NEXT] Capture real wallet context, run the live estimate, then prepare a capped testnet send.");
