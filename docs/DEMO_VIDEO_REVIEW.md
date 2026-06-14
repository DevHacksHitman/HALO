# Halo Final Demo Video Review

Date: 2026-06-14

## Verdict

**CONDITIONAL GO for final demo recording and deployment.**

Halo is strong enough for the HackQuest submission if the video stays evidence-first:

- MetaMask Advanced Permissions appears in the main donor flow.
- Venice is used live in the requester flow and returns meaningful structured output.
- x402 is framed as payment-requirement discovery, not settlement.
- A2A is shown as redelegation proof with separate Verifier and Treasurer lanes.
- 1Shot payment state is shown through `/status` using real grant status data only.
- Base Sepolia execution is claimed; mainnet paid execution is not claimed.

The remaining blockers are not architectural. They are final packaging issues:

1. `DEMO_VIDEO.md` is not safe as the final rehearsal script because it contains pasted tool transcripts and stale instructions.
2. Venice model references have been aligned to `google-gemma-3-27b-it`; confirm the same value is set in Vercel before recording.

======

## 3. `/status` must be populated through Upstash with the Step 20 terminal status proof before the final demo if we want the strongest closing shot.

======

## Review Of `DEMO_VIDEO.md`

**NO-GO as the final recording script.**

The file currently reads like a pasted assistant/task transcript rather than a clean demo runbook. It also contains stale or risky guidance:

- It tells you not to speak. For this hackathon, narration is better. Judges need to hear you name the sponsor integrations and boundaries.
- It references a nonexistent or unverified command: `npm run simulate:step20`.
- It says to type "Need insulin" and `$50`, but the app and Step 21 proof are built around the deterministic inhaler receipt and `$25.00`.
- It says "simulated 1Shot webhook confirms the transaction." That is weaker and riskier than the true claim: Step 20 status proof uses `relayer_getStatus=200` or a signed webhook.
- It includes old Venice model debugging notes and conflicting model names.
- It uses overstrong privacy phrasing like "never saves the image" in places where the safer claim is that Halo keeps raw receipt data server-side and uses Venice as the private verifier path.
- It says funds are automatically routed after AI approval. For the demo, the safe wording is: approval feeds the Treasurer/1Shot path, while paid state is only displayed after relayer confirmation.

**Use `docs/FINAL_DEMO_RUNBOOK.md` plus the rehearsal structure below instead.**

## Final Rehearsal Structure

Target length: **4 to 5 minutes**.

### 1. Overview Page

Show `/`.

Narration:

> Halo is an autonomous mutual aid demo built around scoped wallet permissions. A donor grants narrow USDC authority once, then specialized agents verify requests, discover payment boundaries, prove redelegation, and keep payout status tied to relayer confirmation.

What to show:

- proof rail: MetaMask, Venice, x402, A2A, 1Shot
- "Base Sepolia proof path, mainnet gated"
- footer boundary: `Base Sepolia execution proof`, `Mainnet paid claim gated`

Avoid:

- saying mainnet paid execution is complete
- saying x402 settlement is complete

### 2. Donor Page

Show `/donor`.

Narration:

> The donor side is the MetaMask track. The donor connects MetaMask, fetches the 1Shot relayer target, and requests an Advanced Permission. The important point is scope: Halo does not get broad wallet control.

What to show:

- monthly cap
- per-grant cap
- API budget
- connect wallet
- fetch relayer target
- request permission
- redacted context/dependency output if available

Copy feedback:

- Current H1 is good: `Sponsor a scoped monthly allowance.`
- Current right sidebar is good.
- The lede has been updated to match the live MetaMask surface:

```text
Connect MetaMask, fetch the 1Shot relayer target, request a scoped Advanced Permission, then watch the agent path stay inside explicit caps.
```

### 3. Requester Page

Show `/request`.

Narration:

> This is the requester and agent layer. The requester enters the need and amount. Halo sends the synthetic receipt through the live Venice verifier and receives structured grant reasoning plus a requester-facing message.

Click in order:

1. `Run live Venice verifier`
2. `Capture x402 boundary`
3. `Show A2A proof`

What to show:

- Venice HTTP `200`
- decision `approved`
- category `Medicine`
- receipt hash
- requester-facing message
- x402 `402` requirement captured
- Base mainnet x402 network `eip155:8453`
- A2A Verifier/Treasurer chains
- direct one-hop delegation rejected

Boundary narration:

> Step 21 is live Venice intelligence through Bearer credits. Step 22 captures the real x402 payment requirement without sending `X-402-Payment`. Step 23 proves redelegation. No 1Shot send is triggered from this requester page.

Copy feedback:

- Current H1 is good: `A live verifier flow for urgent help.`
- Current boundary card is correct: `Shadow discovery only.`
- The model fix is correct locally: `.env.local` currently uses `VENICE_VISION_MODEL=google-gemma-3-27b-it`.
- Deployment-critical docs and env examples now point to `google-gemma-3-27b-it`; confirm Vercel uses the same value.

### 4. Status Page

Show `/status`.

Narration:

> This page is intentionally pure 1Shot proof. It does not show fake paid cards, and it does not mix Venice badges into the payment surface. Halo only marks a grant paid after `relayer_getStatus=200` or a signed 1Shot webhook.

What to show:

- `Grant records`
- `In relay`
- `Confirmed sent`
- `Persistence`
- Upstash mode after Vercel deployment
- confirmed Step 20 grant if synced
- redacted task/tx proof

Copy feedback:

- H1 is strong: `1Shot-confirmed grant status.`
- Right sidebar is correct: `No guesswork.`
- Boundary wording is correct: Base Sepolia proof, mainnet locked by Step 24/25.
- This page becomes demo-ready only after Upstash contains the synced Step 20 status record.

## Venice Model Fix Review

**GO, with documentation cleanup required.**

Runtime currently defaults to:

```text
google-gemma-3-27b-it
```

This is a practical fix. The previous qwen vision model produced repeated `429` overload responses, which is an availability problem rather than a Halo verifier bug. The code path still does the right work:

- builds a chat-completions request with Bearer auth
- sends the synthetic receipt image
- requests strict JSON
- parses `valid`, `extracted_amount`, `category`, `reason`, and `grant_message`
- evaluates the result against the requested amount and grant cap
- keeps x402 settlement and paid claims false for Step 21

Before commit/deploy, update stale model references in:

- `.env.example`
- `docs/DEPLOY.md`
- `docs/FINAL_DEMO_RUNBOOK.md`
- `docs/VENICE.md`
- `docs/X_POSTS.md` command snippets if they are meant to be reused

Do not rewrite already-posted public X history just because older posts mention qwen. But do not deploy with qwen in Vercel env vars.

## Git, GitHub, Vercel, And Upstash Readiness

**CONDITIONAL GO to commit and push.**

Do not blindly commit the whole dirty tree. The working tree contains many modified and untracked files. Use a staged commit audit.

Required checks before commit:

```bash
PATH=/usr/local/bin:$PATH npm run test:backend
PATH=/usr/local/bin:$PATH npm run build
forge test
git status --short
git diff --stat
```

Commit safety rules:

- Commit `.env.example`, never `.env.local`.
- Do not commit API keys, private keys, raw permission contexts, webhook signing secrets, Upstash tokens, or raw TaskIds.
- Include app, component, lib, test, script, and docs files that are part of the final demo.
- Review `.agents/`, `skills/`, and generated/public assets intentionally before staging them.

Recommended commit message:

```bash
git commit -m "Prepare Halo final hackathon demo"
```

Vercel deployment is **GO after commit/push** if these env vars are set in Vercel:

```bash
VENICE_API_KEY=...
VENICE_VISION_MODEL=google-gemma-3-27b-it
ONESHOT_API_KEY=...
ONESHOT_RELAYER_TARGET_WALLET_ADDRESS=...
HALO_METAMASK_PERMISSION_CONTEXT=...
HALO_METAMASK_PERMISSION_GRANT_JSON=...
HALO_ONESHOT_WEBHOOK_URL=https://<vercel-domain>/api/webhooks/1shot
HALO_GRANT_STATUS_SYNC_TOKEN=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
HALO_GRANT_STATUS_REDIS_KEY=halo:grant-status-events
NEXT_PUBLIC_HALO_CHAIN_PROFILE=base-sepolia
NEXT_PUBLIC_HALO_CHAIN_ID=84532
NEXT_PUBLIC_HALO_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_HALO_MONTHLY_CAP_USDC=100
NEXT_PUBLIC_ONESHOT_RELAYER_TARGET_WALLET_ADDRESS=...
```

After Vercel deploy:

1. Open `/api/grants` and confirm persistence mode is `upstash-redis`.
2. Sync Step 20 status into the deployed store:

```bash
HALO_GRANT_STATUS_SYNC_URL=https://<vercel-domain>/api/grants/sync \
HALO_GRANT_STATUS_SYNC_TOKEN=<sync-token> \
HALO_STATUS_REPOLL_STEP=20 \
HALO_STATUS_REPOLL_ATTEMPTS=3 \
HALO_STATUS_REPOLL_INTERVAL_MS=2000 \
scripts/demo_step20_status_repoll.sh
```

3. Reopen `/status` and confirm the Step 20 grant remains after refresh.

## Step 24 Mainnet Preflight Post

This remains the only unfinished public-post item.

Use Step 24 only if it produces a clean or useful truthful output. It is not required as the center of the final demo.

Recommended Step 24 X thread:

```text
Step 24 for Halo: Base mainnet preflight.

Every prior execution proof was Base Sepolia. Step 24 is the first time Halo checks the production boundary against Base mainnet infrastructure.

No send. Estimate/preflight only.
```

Reply:

```text
Mainnet preflight checklist:

→ Base mainnet 1Shot profile
→ Production relayer targetAddress
→ Base mainnet USDC
→ Grant + relayer fee caps
→ 7702 smart-account readiness
→ A2A chain length >=2
→ Final delegate matches relayer target

No TaskId.
No /status mutation.
No mainnet payout claim.

@MetaMaskDev @1ShotAPI @AskVenice #BuildInPublic
```

Reply:

```text
Step 25 only happens after this preflight is clean.

Halo does not jump from testnet success to mainnet send. The production boundary is explicit.
```

HackQuest checkpoint under 200 chars:

```text
Step 24: Base mainnet preflight checked production 1Shot profile, relayer target, caps, 7702 readiness, and A2A compatibility. No send.
```

## HackQuest Submission Pitch Text

Use this as the main written submission description.

```text
Halo is an autonomous mutual aid fund built around scoped wallet permissions, private AI verification, and status-confirmed payouts.

The problem is that mutual aid often requires vulnerable people to trade dignity for speed. A requester may need urgent help for medicine or groceries, but the current process usually means sending private receipts to human administrators, waiting for manual review, and trusting a central pool of funds. That creates friction for donors, delay for requesters, and avoidable custody risk for the community.

Halo changes that flow. A donor uses MetaMask Advanced Permissions to grant narrow, capped USDC authority instead of transferring funds into a pooled treasury. A requester submits a need and receipt. Halo uses Venice AI as the live verifier, turning receipt evidence into structured grant reasoning and a human-readable requester message. The agent path then exposes the x402 payment boundary, proves A2A redelegation across Verifier and Treasurer lanes, and keeps payout status tied to 1Shot relayer confirmation.

The demo is deliberately boundary-honest. Step 20 proves a Base Sepolia 1Shot relay/status path with terminal confirmation. Step 21 proves live Venice receipt intelligence. Step 22 captures Venice's real x402 payment requirement without settlement. Step 23 proves A2A redelegation and rejects direct one-hop delegation for A2A claims. Step 24 is a mainnet preflight boundary only, not a paid mainnet claim.

Halo's thesis is simple: community aid can be programmable without becoming custodial, and automated verification can protect user dignity without becoming surveillance. Donors keep control through scoped permissions. Requesters get faster, clearer decisions. Judges can inspect each sponsor integration on its own page: MetaMask on /donor, Venice and A2A on /request, and 1Shot status proof on /status.
```

Short version:

```text
Halo is an autonomous mutual aid fund where donors grant scoped MetaMask permissions, Venice AI verifies urgent receipts, A2A sub-agents separate verifier and treasurer authority, and 1Shot relayer status is the source of truth for paid grants. The demo proves the full Base Sepolia safety loop while keeping mainnet paid claims gated behind a separate preflight/send boundary.
```

## Final Recording Checklist

Before recording:

- Restart the app after confirming `VENICE_VISION_MODEL=google-gemma-3-27b-it`.
- Verify `/request` returns a Venice `200` approval once.
- Verify `/status` reads Upstash in the deployed environment.
- Sync Step 20 into deployed `/status`.
- Close tabs that expose secrets.
- Do not show `.env.local`.
- Do not show raw MetaMask permission context.
- Do not show raw TaskId unless already intentionally safe.

During recording:

- Narrate the sponsor mapping clearly.
- Use the app as the primary surface.
- Keep terminal/script output as backup evidence, not the main product.
- Say "Base Sepolia execution proof" and "mainnet gated."
- Say "x402 payment requirement captured" and not "x402 paid."
- Say "confirmed paid requires relayer status or signed webhook."

Final status:

**GO to rehearse now. CONDITIONAL GO to commit/deploy after model docs are aligned, tests pass, and Step 20 status is synced into Upstash.**
