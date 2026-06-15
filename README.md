# Halo

Halo is an autonomous mutual aid fund where donors grant scoped MetaMask permissions, Venice AI verifies urgent receipts, A2A sub-agents separate verifier and treasurer authority, and 1Shot relayer status is the source of truth for paid grants.

Built for the MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook Off.

## What Halo Proves

Halo is designed around a non-custodial grant loop:

1. A donor grants narrow wallet authority through MetaMask Advanced Permissions.
2. A requester submits an urgent need and receipt.
3. Venice AI verifies the receipt and returns structured grant reasoning.
4. Halo separates authority across A2A Verifier and Treasurer lanes.
5. 1Shot relays the capped USDC payout.
6. Halo marks a grant paid only after `relayer_getStatus=200` or a signed 1Shot webhook.

The final hackathon demo centers on a proven Base Sepolia execution path. Mainnet paid wording remains gated until a future Step 25 mainnet send returns terminal confirmation.

## Current Demo Boundary

**Proven in the final demo path**

- MetaMask donor permission flow.
- Live Venice verifier proof using `google-gemma-3-27b-it`.
- Venice x402 payment-requirement discovery in shadow mode.
- A2A redelegation proof with Verifier and Treasurer lanes.
- Base Sepolia 1Shot relay/status proof with terminal status confirmation.
- `/status` renders real grant state only, with no fake paid cards.

**Not overclaimed**

- Venice x402 settlement is not claimed unless an `X-402-Payment` header is actually sent and confirmed.
- Base mainnet paid execution is not claimed unless the Step 25 mainnet send passes.
- The frontend does not expose a live 1Shot send button. Payout proof is status-backed through `/api/grants`.

## App Routes

- `/` - demo cockpit and proof rail.
- `/donor` - MetaMask donor permission surface.
- `/request` - requester flow with Venice verifier, x402 shadow discovery, and A2A proof.
- `/status` - 1Shot status proof page backed by `/api/grants`.

Deployed demo: [https://halofund.vercel.app](https://halofund.vercel.app)

## Hackathon Track Code Links

### Smart Accounts Kit Usage

**Advanced Permissions**

- Request Advanced Permissions in the donor UI: [components/DonorPermissionClient.tsx](components/DonorPermissionClient.tsx)
- Build the scoped ERC-20 periodic permission request: [lib/haloPermissions.mjs](lib/haloPermissions.mjs)
- Capture and redact the wallet-returned permission grant/context: [lib/metaMaskPermissionCapture.mjs](lib/metaMaskPermissionCapture.mjs), [lib/metaMaskPermissionHandoff.mjs](lib/metaMaskPermissionHandoff.mjs)
- Decode the MetaMask permission context before 1Shot estimate/send: [lib/metaMaskPermissionDecoder.mjs](lib/metaMaskPermissionDecoder.mjs)
- Redeem the decoded Advanced Permission through 1Shot estimate/send gates: [lib/oneShotEstimatePreflight.mjs](lib/oneShotEstimatePreflight.mjs), [lib/oneShotSendGate.mjs](lib/oneShotSendGate.mjs), [scripts/demo_step20_relay_reconciliation.mjs](scripts/demo_step20_relay_reconciliation.mjs)

**Delegations**

- Normalize ERC-7710 delegation arrays for 1Shot requests: [lib/oneShot.mjs](lib/oneShot.mjs)
- Build verifier/treasurer execution drafts from delegated authority: [lib/haloAgentBridge.mjs](lib/haloAgentBridge.mjs)
- Solidity lane policy source for delegated sub-agents: [src/HaloAlmoner.sol](src/HaloAlmoner.sol), [src/HaloVerifier.sol](src/HaloVerifier.sol), [src/HaloTreasurer.sol](src/HaloTreasurer.sol)
- Tests for delegated execution shape and caveats: [test/HaloAlmoner.t.sol](test/HaloAlmoner.t.sol), [test/HaloSubAgents.t.sol](test/HaloSubAgents.t.sol)

**Redelegation**

- Deterministic A2A redelegation proof with Verifier and Treasurer lanes: [lib/a2aRedelegationProof.mjs](lib/a2aRedelegationProof.mjs)
- In-app A2A proof API: [app/api/a2a/proof/route.ts](app/api/a2a/proof/route.ts)
- Public Step 23 proof script: [scripts/demo_step23_a2a_redelegation_proof.mjs](scripts/demo_step23_a2a_redelegation_proof.mjs)
- Redelegation policy/caveat source: [src/HaloAlmoner.sol](src/HaloAlmoner.sol)

### x402 Usage

Halo currently proves x402 discovery and readiness boundaries. It does not claim live Venice x402 settlement in the final Base Sepolia demo.

- Server route that captures Venice x402 payment requirements without sending `X-402-Payment`: [app/api/venice/x402-shadow/route.ts](app/api/venice/x402-shadow/route.ts)
- x402 payment-requirement parsing and public-safe summary: [lib/veniceVerifier.mjs](lib/veniceVerifier.mjs)
- Public Step 22 shadow probe script: [scripts/demo_step22_venice_x402_shadow_probe.mjs](scripts/demo_step22_venice_x402_shadow_probe.mjs)
- Guarded x402 ERC-7710/delegated fetch readiness code: [lib/veniceVerifier.mjs](lib/veniceVerifier.mjs)
- Verifier-lane USDC transfer draft for x402 top-up payment: [lib/haloAgentBridge.mjs](lib/haloAgentBridge.mjs)

### 1Shot API Usage

- 1Shot JSON-RPC request builders for capabilities, fee data, estimate, send, and status: [lib/oneShot.mjs](lib/oneShot.mjs)
- Server route for `relayer_getCapabilities`: [app/api/oneshot/capabilities/route.ts](app/api/oneshot/capabilities/route.ts)
- Live estimate preflight and cap checks: [lib/oneShotEstimatePreflight.mjs](lib/oneShotEstimatePreflight.mjs)
- 1Shot fee payment plan: [lib/oneShotFeePlan.mjs](lib/oneShotFeePlan.mjs)
- Live send gate and reconciliation: [lib/oneShotLiveSendRehearsal.mjs](lib/oneShotLiveSendRehearsal.mjs), [lib/relayReconciliation.mjs](lib/relayReconciliation.mjs)
- Step 20 Base Sepolia send/status proof scripts: [scripts/demo_step20_relay_reconciliation.mjs](scripts/demo_step20_relay_reconciliation.mjs), [scripts/demo_step20_status_repoll.mjs](scripts/demo_step20_status_repoll.mjs)
- Status polling and terminal confirmation normalization: [lib/oneShotRelayConfirmation.mjs](lib/oneShotRelayConfirmation.mjs), [lib/grantStatus.mjs](lib/grantStatus.mjs)
- 1Shot webhook receiver and signature verification: [app/api/webhooks/1shot/route.ts](app/api/webhooks/1shot/route.ts), [lib/oneShotWebhookSignature.mjs](lib/oneShotWebhookSignature.mjs)

### Venice AI Usage

- Live Venice verifier API route using server-side `VENICE_API_KEY`: [app/api/venice/verify/route.ts](app/api/venice/verify/route.ts)
- Venice prompt construction, response parsing, x402 parsing, and readiness reports: [lib/veniceVerifier.mjs](lib/veniceVerifier.mjs)
- Shared frontend proof helpers for live Venice verifier and x402 shadow proof: [lib/demoProofs.mjs](lib/demoProofs.mjs)
- Requester UI that runs Venice verifier from the app: [components/RequesterAgentClient.tsx](components/RequesterAgentClient.tsx)
- Public Step 21 live verifier script: [scripts/demo_step21_venice_live_verifier.mjs](scripts/demo_step21_venice_live_verifier.mjs)
- Public Step 22 x402 shadow script: [scripts/demo_step22_venice_x402_shadow_probe.mjs](scripts/demo_step22_venice_x402_shadow_probe.mjs)
- Venice tests: [test/backend/veniceVerifier.test.mjs](test/backend/veniceVerifier.test.mjs), [test/backend/demoProofs.test.mjs](test/backend/demoProofs.test.mjs)

## Tech Stack

- Next.js 16
- React 19
- Viem
- MetaMask Smart Accounts Kit
- 1Shot relayer API
- Venice AI API
- x402 packages: `@x402/core`, `@x402/fetch`, `@metamask/x402`
- Optional Upstash Redis persistence on Vercel
- Foundry Solidity tests

## Local Setup

Install dependencies:

```bash
npm install
```

Create local environment values from the example:

```bash
cp .env.example .env.local
```

Fill only the values needed for the route or proof you are running. Never commit `.env.local`.

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Key Environment Variables

Core public demo values:

```bash
HALO_CHAIN_PROFILE=base-sepolia
NEXT_PUBLIC_HALO_CHAIN_PROFILE=base-sepolia
NEXT_PUBLIC_HALO_CHAIN_ID=84532
NEXT_PUBLIC_HALO_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_HALO_MONTHLY_CAP_USDC=100
```

Venice verifier:

```bash
VENICE_API_KEY=...
VENICE_VISION_MODEL=google-gemma-3-27b-it
```

1Shot and MetaMask proof path:

```bash
ONESHOT_API_KEY=...
ONESHOT_RELAYER_TARGET_WALLET_ADDRESS=...
NEXT_PUBLIC_ONESHOT_RELAYER_TARGET_WALLET_ADDRESS=...
HALO_METAMASK_PERMISSION_CONTEXT=...
HALO_METAMASK_PERMISSION_GRANT_JSON=...
```

Optional Vercel persistence:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
HALO_GRANT_STATUS_REDIS_KEY=halo:grant-status-events
```

Webhook callback after deploy:

```bash
HALO_ONESHOT_WEBHOOK_URL=https://your-vercel-url.vercel.app/api/webhooks/1shot
ONESHOT_WEBHOOK_PUBLIC_KEY=...
ONESHOT_WEBHOOK_JWKS_URL=...
```

## Verification

Backend tests:

```bash
PATH=/usr/local/bin:$PATH npm run test:backend
```

Next.js build:

```bash
PATH=/usr/local/bin:$PATH npm run build
```

Solidity tests:

```bash
forge test
```

Recent local verification before final demo preparation:

- Backend tests: 166 passing.
- Next.js build: passing.
- Foundry tests: 18 passing.

## Demo Proof Sequence

Recommended final video flow:

1. Open `/` and show the proof rail.
2. Open `/donor` and show scoped MetaMask permission boundaries.
3. Open `/request` and run the live Venice verifier.
4. Capture the x402 payment requirement in shadow mode.
5. Show A2A redelegation proof and direct-delegation rejection.
6. Open `/status` and show that paid state depends only on real 1Shot status/webhook evidence.

The final demo runbook is in [docs/FINAL_DEMO_RUNBOOK.md](docs/FINAL_DEMO_RUNBOOK.md).

## Important Docs

- [Final demo runbook](docs/FINAL_DEMO_RUNBOOK.md)
- [Demo video review](docs/DEMO_VIDEO_REVIEW.md)
- [Venice integration notes](docs/VENICE.md)
- [Mainnet/testnet boundary](docs/MAINNET_TESTNET_NUANCE.md)
- [Deployment notes](docs/DEPLOY.md)
- [Judge review notes](docs/JUDGE_REVIEW.md)

## Feedback

Builder feedback from Halo's implementation work:

- 1Shot status/webhook alignment matters. `relayer_getStatus=200` and signed webhook confirmation should be documented as the public boundary for paid wording.
- The 1Shot public relayer API is powerful, but developers need very explicit examples for `relayer_getCapabilities.targetAddress`, decoded `permissionContext`, `authorizationList`, `dependencies[]`, and status/webhook payload shapes.
- MetaMask Advanced Permissions are strongest when the UI shows the selected chain, token, relayer target, cap, dependency count, and 7702 readiness before any send.
- x402 integrations need clear sponsor examples for discovery-only `402` capture versus actual `X-402-Payment` settlement. Halo keeps those claims separate.
- Venice model choice matters for demo reliability. Halo uses `google-gemma-3-27b-it` and sends receipt image plus local receipt fields so the live verifier has deterministic evidence.

Related notes:

- [Mainnet/testnet boundary](docs/MAINNET_TESTNET_NUANCE.md)
- [Final auditor review brief](docs/FINAL_AUDITOR_REVIEW_BRIEF.md)
- [Mentor checkpoints](docs/MENTOR_CHECKPOINTS.md)

## Social Media

Halo was built in public through step-by-step X/HackQuest checkpoints. Public threads:

- [Build thread 1](https://x.com/DevHacksHitman/status/2060888089636081824?s=20)
- [Build thread 2](https://x.com/DevHacksHitman/status/2062737926988181929?s=20)
- [Build thread 3](https://x.com/DevHacksHitman/status/2063780842371969270?s=20)

The social sequence covers donor permissions, 1Shot estimate/send/status proof, Venice live verifier, x402 shadow discovery, A2A redelegation proof, and the mainnet preflight boundary.

## Security And Claim Boundaries

Halo does not custody donor funds in the demo architecture. The proof path relies on scoped permissions, capped execution, status confirmation, and explicit separation between verifier and treasurer authority.

`/status` is intentionally strict:

- `PAID` is displayed only as confirmed paid.
- `RELAYING` is displayed as in relay.
- `FAILED` is displayed as needs review.
- Static sample cards cannot create paid state.

Mainnet is treated as a production gate, not as a completed hackathon payout claim.
