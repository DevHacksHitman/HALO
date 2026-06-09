export const stepProofs = [
  {
    label: "Step 1",
    value: "10 tests",
    detail: "Master Almoner caveat boundaries are passing.",
  },
  {
    label: "Step 2",
    value: "8 tests",
    detail: "Verifier and Treasurer payload builders are passing.",
  },
  {
    label: "Step 3",
    value: "6 tests",
    detail: "Backend 1Shot relay drafts are passing.",
  },
  {
    label: "Step 4",
    value: "3 routes",
    detail: "Next.js app shell builds and routes locally.",
  },
  {
    label: "Step 5",
    value: "4 tests",
    detail: "MetaMask Advanced Permission request builder is passing.",
  },
  {
    label: "Step 6",
    value: "5 tests",
    detail: "1Shot ERC-7710 relay request shape is passing.",
  },
  {
    label: "Step 7",
    value: "6 tests",
    detail: "Venice/x402 verifier flow is passing.",
  },
  {
    label: "Step 8",
    value: "4 tests",
    detail: "Webhook status reducer is passing.",
  },
  {
    label: "Step 9",
    value: "4 tests",
    detail: "Base Sepolia deploy config is passing.",
  },
];

export const workflowColumns = [
  {
    title: "Permissions",
    items: ["EIP-7702 upgrade path", "ERC-7715 scoped allowance", "ERC-7710 redelegation chain"],
  },
  {
    title: "Agents",
    items: ["Master Almoner scopes caveats", "Verifier prepares x402 fee payment", "Treasurer prepares grant payout"],
  },
  {
    title: "Execution",
    items: ["USDC remains in donor wallet", "1Shot relays delegated execution", "Webhook updates grant status"],
  },
];

export const terminalLines = [
  "$ forge test -vvv",
  "[PASS] HaloAlmonerTest: 10 passed",
  "[PASS] HaloSubAgentsTest: 8 passed",
  "$ npm run test:backend",
  "[PASS] Halo backend bridge: 5 passed",
  "[PASS] Halo deploy config: 4 passed",
  "[PASS] Halo Venice verifier: 6 passed",
  "[PASS] Halo grant status: 4 passed",
  "[1Shot] Draft target=USDC token",
  "[VENICE] x402 top-up parsed",
  "[WEBHOOK] status events append-only",
  "[EVM] recipient encoded in transfer calldata",
  "[1Shot] transactions[0].permissionContext validated",
];

export const donorSteps = [
  {
    title: "Connect MetaMask",
    copy: "The donor starts from a normal EOA and connects through the injected MetaMask provider.",
  },
  {
    title: "Select Base Sepolia",
    copy: "The UI moves the wallet onto the chain where the Smart Account and USDC permission will be tested.",
  },
  {
    title: "Grant permission",
    copy: "The donor signs an ERC-7715 periodic USDC allowance rather than transferring funds into a pool.",
  },
  {
    title: "Observe activity",
    copy: "The returned permission context becomes the Step 6 input for 1Shot delegated redemption.",
  },
];

export const donorTerminalLines = [
  "[MetaMask] requestExecutionPermissions adapter wired.",
  "[ERC-7715] Permission type: erc20-token-periodic.",
  "[SECURITY] Browser receives only a session account address.",
  "[A2A] Almoner caveat tests passing.",
  "[1Shot] relayer request shape aligned.",
];

export const requestTerminalLines = [
  "[REQUEST] Claim intake shell mounted.",
  "[A2A] Master agent trigger queued.",
  "[x402] Verifier payment draft tested.",
  "[VENICE] Receipt verification request tested.",
  "[TREASURER] Grant payout draft tested.",
];

export const statusCards = [
  {
    state: "VERIFYING",
    title: "Inhaler refill",
    detail: "Requester evidence is being checked by the Venice verifier flow.",
    taskId: "grant-local-001",
  },
  {
    state: "RELAYING",
    title: "1Shot payout draft",
    detail: "Treasurer execution is prepared and waiting for live permission context.",
    taskId: "0xaaaaaaaa...aaaa",
  },
  {
    state: "PAID",
    title: "Webhook success sample",
    detail: "A local webhook event can mark a grant paid and attach the tx hash.",
    taskId: "0xbbbbbbbb...bbbb",
  },
];

export const statusTerminalLines = [
  "[WEBHOOK] POST /api/webhooks/1shot",
  "[1Shot] task status normalized.",
  "[STORE] Grant event appended.",
  "[STATUS] UI reads /api/grants.",
  "[STATUS] Paid grants cannot be downgraded.",
  "[SECURITY] Live signature verification waits for provider signature details.",
];

export const grantFeed = [
  {
    amount: "$25",
    title: "Inhaler refill",
    detail: "Pending Venice verification and 1Shot payout wiring.",
  },
  {
    amount: "$30",
    title: "Baby formula",
    detail: "Demo copy for anonymous community feed.",
  },
  {
    amount: "$18",
    title: "Transit fare",
    detail: "Webhook status card placeholder.",
  },
];
