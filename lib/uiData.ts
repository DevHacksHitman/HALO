export const stepProofs = [
  {
    label: "MetaMask",
    value: "live",
    detail: "Donor permission capture happens in the app, with raw context redacted.",
  },
  {
    label: "Venice",
    value: "Step 21",
    detail: "Live verifier turns the inhaler receipt into structured grant reasoning.",
  },
  {
    label: "x402",
    value: "Step 22",
    detail: "Payment requirement is captured in shadow mode with no USDC spend.",
  },
  {
    label: "A2A",
    value: "Step 23",
    detail: "Two-hop Verifier and Treasurer redelegation proof is available in-app.",
  },
  {
    label: "1Shot",
    value: "Step 20",
    detail: "Paid state is status-backed through /api/grants, not a static sample.",
  },
];

export const workflowColumns = [
  {
    title: "Donor",
    items: ["Connect MetaMask", "Grant scoped USDC permission", "Keep funds out of pooled custody"],
  },
  {
    title: "Agents",
    items: ["Venice verifies receipt evidence", "A2A splits Verifier and Treasurer lanes", "x402 remains shadow until settlement is wired"],
  },
  {
    title: "Status",
    items: ["1Shot returns TaskId/status", "Webhook or polling confirms terminal state", "PAID appears only after confirmation"],
  },
];

export const terminalLines = [
  "[DEMO] Frontend path is the primary recording surface.",
  "[MetaMask] Donor permission request remains live in /donor.",
  "[VENICE] /api/venice/verify keeps VENICE_API_KEY server-side.",
  "[x402] /api/venice/x402-shadow sends no X-402-Payment header.",
  "[A2A] /api/a2a/proof exposes chain length and lane summaries only.",
  "[1Shot] /status reads reducer-backed /api/grants data.",
  "[BOUNDARY] No browser button triggers a live relay send.",
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
  "[REQUEST] Need and amount stay editable for the demo.",
  "[VENICE] Live verifier route returns structured decision.",
  "[x402] Shadow route captures payment requirement only.",
  "[A2A] Proof route rejects one-hop direct delegation.",
  "[BOUNDARY] Requester page cannot call relayer_send7710Transaction.",
];

export const statusTerminalLines = [
  "[WEBHOOK] POST /api/webhooks/1shot",
  "[1Shot] task status normalized.",
  "[STORE] Grant event appended.",
  "[STATUS] UI reads /api/grants.",
  "[STATUS] Paid grants cannot be downgraded.",
  "[SECURITY] Live callbacks require a verified signature.",
];
