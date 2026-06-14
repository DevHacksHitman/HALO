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

## Security And Claim Boundaries

Halo does not custody donor funds in the demo architecture. The proof path relies on scoped permissions, capped execution, status confirmation, and explicit separation between verifier and treasurer authority.

`/status` is intentionally strict:

- `PAID` is displayed only as confirmed paid.
- `RELAYING` is displayed as in relay.
- `FAILED` is displayed as needs review.
- Static sample cards cannot create paid state.

Mainnet is treated as a production gate, not as a completed hackathon payout claim.
