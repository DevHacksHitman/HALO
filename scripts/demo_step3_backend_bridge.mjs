import {
  prepareTreasurerGrantRelay,
  prepareVerifierX402Relay,
} from "../lib/haloAgentBridge.mjs";

const chainId = 84532;
const usdcToken = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
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
});

printDraft(verifierDraft);
printDraft(treasurerDraft);

function printDraft(draft) {
  console.log("");
  console.log(`[HALO] ${draft.kind}`);
  for (const line of draft.logs) {
    console.log(line);
  }
  console.log(`[EVM] target=${draft.execution.target}`);
  console.log(`[EVM] recipient=${draft.transfer.recipient}`);
  console.log(`[EVM] amount=${draft.transfer.amount}`);
  console.log(`[1Shot] method=${draft.request.method}`);
  console.log(`[1Shot] endpoint=${draft.endpoint}`);
  console.log(`[1Shot] params.chainId=${draft.request.params.chainId}`);
  console.log(`[1Shot] transactions=${draft.request.params.transactions.length}`);
  console.log(
    `[1Shot] permissionContext[0].delegate=${draft.request.params.transactions[0].permissionContext[0].delegate}`,
  );
  console.log(`[1Shot] executions[0].target=${draft.request.params.transactions[0].executions[0].target}`);
}
