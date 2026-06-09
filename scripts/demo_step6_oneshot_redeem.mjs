import {
  prepareTreasurerGrantRelay,
  prepareVerifierX402Relay,
} from "../lib/haloAgentBridge.mjs";
import {
  ONESHOT_RELAYER_RPC_URL,
  buildEstimate7710Request,
  buildGetCapabilitiesRequest,
  buildGetStatusRequest,
} from "../lib/oneShot.mjs";

const chainId = 84532;
const usdcToken = process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const venicePaymaster = "0xcccccccccccccccccccccccccccccccccccccccc";
const requester = "0xdddddddddddddddddddddddddddddddddddddddd";
const permissionContext = [
  {
    delegate: "0x1111111111111111111111111111111111111111",
    delegator: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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

console.log("[1Shot] endpoint=" + ONESHOT_RELAYER_RPC_URL);
console.log("[1Shot] Step 1 request: relayer_getCapabilities");
console.log(JSON.stringify(buildGetCapabilitiesRequest([chainId]), null, 2));

const verifierDraft = prepareVerifierX402Relay({
  chainId,
  usdcToken,
  venicePaymaster,
  feeAmount: 1_500_000,
  permissionContext,
});

const treasurerDraft = prepareTreasurerGrantRelay({
  chainId,
  usdcToken,
  requester,
  grantAmount: 25_000_000,
  permissionContext,
  quoteContext: "{\"quote\":\"estimate-context-from-step-2\"}",
  destinationUrl: "https://example.com/api/webhooks/1shot",
});

printRelay("VERIFIER_X402_ESTIMATE", verifierDraft);
printRelay("TREASURER_GRANT_SEND_DRAFT", treasurerDraft);

console.log("");
console.log("[1Shot] Step 4 polling fallback request: relayer_getStatus");
console.log(
  JSON.stringify(
    buildGetStatusRequest({
      taskId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      logs: false,
    }),
    null,
    2,
  ),
);

function printRelay(label, draft) {
  console.log("");
  console.log(`[HALO] ${label}`);
  for (const line of draft.logs) {
    console.log(line);
  }
  console.log(`[EVM] USDC target=${draft.execution.target}`);
  console.log(`[EVM] transfer recipient=${draft.transfer.recipient}`);
  console.log(`[EVM] transfer amount=${draft.transfer.amount}`);
  console.log("[1Shot] Estimate request:");
  console.log(JSON.stringify(buildEstimate7710Request(draft.request.params), null, 2));
  console.log("[1Shot] Send request draft:");
  console.log(JSON.stringify(draft.request, null, 2));
}
