# UI Polish Brief

## Goal

Polish Halo for a hackathon demo without changing protocol semantics.

The UI should feel like a serious grant operations console: calm, dense, legible, and evidence-first. Avoid a marketing landing page. The first screen should show the actual product loop.

The product language should stay user-friendly. Boundary labels such as `shadow only`, `local proof`, and `status-backed` are for judge/auditor clarity, not alarmist user copy.

## Non-Negotiables

- Do not invent fake paid grants.
- Do not show `PAID` unless `/api/grants` contains confirmed state.
- Do not expose raw permission context, signatures, API keys, webhook secrets, or private addresses.
- Do not imply mainnet execution unless Step 25 actually passes.
- Do not claim x402 settlement from Step 22.
- Do not claim onchain A2A execution from Step 23.

## Primary Screens

### Home

Purpose: orient the judge in 10 seconds.

Show:

- current demo lane: Base Sepolia,
- completed proof strip: MetaMask, Venice, x402 shadow, A2A, 1Shot status,
- latest grant state from real `/api/grants`,
- clear entry points to Donor, Request, and Status.

### Donor

Purpose: show scoped permission instead of broad wallet control.

Show:

- selected chain,
- USDC token,
- donor cap,
- relayer target preview,
- dependency count,
- authorizationList presence,
- redacted permission context status.

Use compact status rows and icons. Avoid long explanatory paragraphs.

### Request

Purpose: show the human need and verifier input.

Show:

- need,
- requested amount,
- receipt evidence preview,
- Venice verifier result,
- x402 shadow proof as a payment-boundary card, not a payment button,
- A2A proof as an authority-boundary card, not a transaction execution claim,
- requester-facing message.

Keep the tone dignified. Do not make the requester look like a case study or charity ad.

### Status

Purpose: prove Halo does not overclaim.

Show:

- grant id or local proof id,
- current status,
- TaskId hash if present,
- tx hash if present,
- source of truth: signed webhook or `relayer_getStatus`,
- balance reconciliation if available,
- timestamp.

Use a separate "shadow / proof" section for Step 21 to 23 artifacts so they cannot be confused with paid state.

On Vercel, status should read from `/api/grants` backed by Upstash Redis when configured. Local process memory is only a fallback for development.

## Visual Direction

- Quiet operational palette with strong contrast.
- Avoid oversized hero sections.
- Avoid decorative gradients, blobs, and card stacks.
- Use cards only for repeated grant records or compact proof modules.
- Keep borders tight, roughly 8px radius or less.
- Use icons for protocol markers and actions.
- Use clear states: `ready`, `shadow`, `confirmed`, `blocked`, `no-go`.
- Keep all text within containers on mobile and desktop.

## Recommended Proof Rail

Add a vertical or horizontal proof rail:

```text
MetaMask permission -> Venice verifier -> x402 shadow -> A2A redelegation -> 1Shot relay -> /status confirmed
```

Each step should show:

- status,
- evidence hash or redacted reference,
- boundary label.

Boundary labels:

- `live verifier`
- `shadow only`
- `local proof`
- `testnet relay`
- `confirmed paid`

## Frontend Designer Prompt

Use this prompt for a frontend-focused model:

```text
Polish the existing Halo Next.js app as a serious grant operations console for a hackathon demo. Do not create a marketing landing page. Preserve all existing data flows and status semantics.

Priorities:
- make the first screen show the real Halo loop,
- improve /donor, /request, and /status visual hierarchy,
- add a compact proof rail for MetaMask, Venice, x402 shadow, A2A, 1Shot, and status,
- make confirmed paid state visually distinct from shadow/local proofs,
- keep secrets and raw contexts redacted,
- keep Base Sepolia and mainnet boundaries explicit,
- keep user-facing copy simple: request, verify, authorize, track,
- keep judge-facing proof labels compact and factual,
- do not add any button that triggers a live 1Shot send,
- ensure mobile and desktop layouts have no overlapping text.

Design tone: calm, operational, evidence-first, dignified. Avoid fake empathy, decorative gradients, oversized hero sections, and fake paid sample cards.
```

## Acceptance Checklist

- Home shows product function within the first viewport.
- `/status` uses real grant data only.
- Step 21/22/23 proofs cannot be mistaken for paid state.
- Step 20 paid proof is clearly Base Sepolia.
- Mainnet appears only as a gated future/production lane.
- Mobile view is readable.
- No text overlaps.
- No secret-like strings are displayed.
