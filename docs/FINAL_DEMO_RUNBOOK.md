# Final Demo Runbook

## Verdict

**CONDITIONAL GO for a complete hackathon demo using the proven Base Sepolia path.**

Halo has enough evidence for a strong demo if the video is framed precisely:

- Base Sepolia is the execution lane.
- Mainnet is a gated production lane.
- Step 20 is the paid/status proof.
- Steps 21 to 23 are now available from the frontend requester flow.
- Step 24/25 are not claimed unless they pass live.

The video should be a frontend product demo first. Scripts are audit evidence and backup footage, not the main recording surface.

## Do Not Re-Send Casually

Step 20 already proved a live send. Do not rerun `scripts/demo_step20_relay_reconciliation.sh` with `HALO_ONESHOT_LIVE=1` just for recording unless a new payout is intentionally approved.

For video, prefer:

- existing Step 20 terminal recording,
- `/status` showing the synced paid grant,
- or a status-only repoll if the saved TaskId is available.

## Environment Checklist

Base Sepolia demo-critical values:

- `ONESHOT_API_KEY`
- `ONESHOT_RELAYER_TARGET_WALLET_ADDRESS`
- `HALO_METAMASK_PERMISSION_CONTEXT`
- `HALO_METAMASK_PERMISSION_GRANT_JSON`
- `HALO_ONESHOT_WEBHOOK_URL`
- `VENICE_API_KEY`
- `NEXT_PUBLIC_HALO_CHAIN_ID=84532`
- `NEXT_PUBLIC_HALO_USDC_ADDRESS=<Base Sepolia USDC>`
- `NEXT_PUBLIC_HALO_MONTHLY_CAP_USDC=100`

Vercel status persistence:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `HALO_GRANT_STATUS_REDIS_KEY=halo:grant-status-events`

Without Upstash, `/api/grants` and `/status` use local process memory and may reset after restart or Vercel cold starts. With Upstash, grant status events are stored append-only and replayed through the same reducer.

Recommended additions to `.env.local` for clarity:

```bash
NEXT_PUBLIC_HALO_CHAIN_PROFILE=base-sepolia
VENICE_VISION_MODEL=google-gemma-3-27b-it
HALO_MAINNET_DEMO_GRANT_USDC=5
HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC=0.01
HALO_MAINNET_MAX_RELAYER_FEE_USDC=0.50
HALO_GRANT_STATUS_REDIS_KEY=halo:grant-status-events
```

Mainnet-only value:

```bash
BASE_MAINNET_RPC_URL=...
```

Only add `BASE_MAINNET_RPC_URL` when running Step 24. It is not needed for the Base Sepolia final demo spine.

## Pre-Recording Verification

Run these once before recording:

```bash
npm run test:backend
npm run build
forge test
```

Optional script checks, only for backup evidence:

```bash
VENICE_VISION_MODEL=google-gemma-3-27b-it scripts/demo_step21_venice_live_verifier.sh
scripts/demo_step22_venice_x402_shadow_probe.sh
scripts/demo_step23_a2a_redelegation_proof.sh
```

If Foundry cannot write its global cache under the sandbox, treat that cache warning as non-blocking only if the tests themselves pass.

## Local App Setup

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
http://localhost:3000/donor
http://localhost:3000/request
http://localhost:3000/status
```

If using ngrok for webhook demonstrations:

```text
HALO_ONESHOT_WEBHOOK_URL=https://<your-ngrok-domain>/api/webhooks/1shot
```

The app does not need a purchased domain for the hackathon video. Ngrok is enough for local callback testing. A deployment URL is enough later; a custom domain is optional.

## Vercel Deployment

Use Vercel env vars for all server-side secrets. Do not prefix these with `NEXT_PUBLIC_`:

```bash
ONESHOT_API_KEY=...
VENICE_API_KEY=...
HALO_METAMASK_PERMISSION_CONTEXT=...
HALO_METAMASK_PERMISSION_GRANT_JSON=...
HALO_ONESHOT_WEBHOOK_URL=https://<vercel-domain>/api/webhooks/1shot
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
HALO_GRANT_STATUS_REDIS_KEY=halo:grant-status-events
```

Set only browser-safe values as public env vars:

```bash
NEXT_PUBLIC_HALO_CHAIN_PROFILE=base-sepolia
NEXT_PUBLIC_HALO_CHAIN_ID=84532
NEXT_PUBLIC_HALO_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_HALO_MONTHLY_CAP_USDC=100
NEXT_PUBLIC_ONESHOT_RELAYER_TARGET_WALLET_ADDRESS=...
```

After deployment, check:

- `/api/grants` returns `"persistence":{"mode":"upstash-redis"}`.
- `/status` still shows the synced Step 20 paid grant after a redeploy or cold start.
- proof routes do not expose API keys, receipt data URLs, raw permission contexts, or payment headers.

## Recording Structure

Target length: 3 to 5 minutes.

### 1. Problem And Product

Show the app, not a landing page.

Say:

> Halo lets donors give a scoped USDC permission once, then narrow agents verify urgent needs and execute capped grants without broad wallet control.

Avoid:

> AI has empathy.

Prefer:

> Venice helps Halo produce human-readable, dignity-preserving decisions while protocol gates enforce caps and payment boundaries.

### 2. Donor Permission Flow

Show `/donor`.

Capture:

- selected chain,
- USDC token,
- monthly cap,
- relayer target,
- permission context captured locally,
- raw context redacted.

Say:

> The donor grants a narrow permission. Halo does not get broad wallet control.

### 3. Requester Need And Receipt

Show `/request`.

Use the inhaler refill example:

- need: asthma inhaler refill,
- requested amount: `$25.00`,
- category: medicine/pharmacy.

Say:

> This is the verifier input: need, amount, and receipt evidence.

### 4. Step 21: Live Venice Verifier

In `/request`, click:

```text
Run live Venice verifier
```

Show:

- response status `200`,
- parsed structured result,
- decision approved,
- requester message.

Say:

> This is live Venice intelligence, not x402 settlement and not a paid claim.

### 5. Step 22: Venice x402 Shadow

In `/request`, click:

```text
Capture x402 boundary
```

Show:

- `402` captured as expected,
- Base mainnet network `eip155:8453`,
- USDC asset,
- amount atoms,
- no `X-402-Payment` header.

Say:

> Halo can see the real Venice payment boundary before spending USDC.

### 6. Step 23: A2A Redelegation

In `/request`, click:

```text
Show A2A proof
```

Show:

- Verifier lane chain length `2`,
- Treasurer lane chain length `2`,
- direct delegation rejected,
- final delegate matches the relayer target.

Say:

> A2A means donor to Master/Almoner to specialized lanes. One-hop donor-to-relayer is rejected for A2A wording.

### 7. Step 20: Paid Status Proof

Show `/status` and existing Step 20 media if useful.

If a saved TaskId is available and the script can repoll without sending:

```bash
HALO_GRANT_STATUS_SYNC_URL=http://127.0.0.1:3000/api/grants HALO_STATUS_REPOLL_STEP=20 HALO_STATUS_REPOLL_ATTEMPTS=3 HALO_STATUS_REPOLL_INTERVAL_MS=2000 scripts/demo_step20_status_repoll.sh
```

Show:

- TaskId redacted or hashed,
- `relayer_getStatus=200`,
- tx hash present,
- `/status=PAID`,
- balance reconciliation.

Say:

> Paid status is only shown after relayer status confirmation or a verified webhook.

### 8. Status UI

Stay on `/status` for the final proof of paid state.

The page must make it obvious that:

- paid state comes from real grant data,
- fake/sample paid cards are not being used,
- transaction/status evidence is visible but redacted where needed.

### 9. Mainnet Boundary

Mention briefly:

> The Base mainnet path is implemented as Step 24/25 gates. We do not claim mainnet execution unless the preflight and send pass.

Do not let mainnet become the center of the video unless Step 24 passes cleanly.

## Optional Step 24 Clip

Only include Step 24 if it gives a clean or useful truthful output.

Command:

```bash
HALO_MAINNET_DEMO_GRANT_USDC=5 HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC=0.01 HALO_ONESHOT_ESTIMATE_LIVE=1 HALO_ONESHOT_LIVE=0 scripts/demo_step24_mainnet_preflight.sh
```

Allowed wording:

> Mainnet preflight only, no send.

Blocked wording:

> Mainnet payout complete.

## Final Demo Claim

Use this close:

> Halo proves the full safety loop: scoped permission, AI verification, x402 payment-boundary discovery, A2A redelegation, relayed payout, and status-confirmed grant state.

## Submission Checklist

- Video shows the app, not only terminal logs.
- Video shows MetaMask permission in the main flow.
- Video shows Venice producing meaningful output.
- Video shows 1Shot status proof.
- Video shows `/status` reflecting real grant state.
- Video distinguishes Base Sepolia proof from mainnet readiness.
- No raw API keys, permission context, signatures, or private keys are visible.
- No fake `PAID` claim.
- No token-launch language.
