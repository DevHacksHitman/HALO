# Agent Directive: Review Judge Ruling and Act

## Context

An independent judge reviewed two conflicting opinions about Halo's `/status` page design for the MetaMask x 1Shot x Venice AI Dev Cook Off hackathon submission:

- **Opinion 1 (Gemini):** `docs/JUDGE_REVIEW.md`
- **Opinion 2 (GPT):** `docs/GPT_SECOND_OPINION.md`
- **Final Ruling:** Located at the following path — read this file FIRST before doing anything:
  `/Users/apple/.gemini/antigravity-ide/brain/a8da7532-3c6a-40af-a780-0ed0fb5d40c7/judge_ruling.md`

## Your Task

1. **Read the ruling file above in full.** Understand every point and the final scorecard.

2. **Accept the following rulings as final decisions — do NOT re-litigate them:**
   - ✅ Do NOT add Venice AI badges or references to `/status`. Venice belongs on `/request`.
   - ✅ Do NOT drop the A2A track. Step 23 A2A redelegation proof stays on `/request`.
   - ✅ Do NOT claim Venice x402 is settled. Keep the honest "discovery only" boundary language.
   - ✅ The `/status` page headline, subtitle, and sidebar ("Judge proof" + "Boundary") are approved as-is. Do not change them.

3. **Implement the ONE approved change to `/status`:**
   - In `components/GrantStatusClient.tsx`, replace the 4th metric card ("Status log: Local / Local test mode; updates may reset.") with something more useful for the hackathon judges.
   - The ruling recommends either **"Webhook events"** (count of signed 1Shot webhooks received) or **"Persistence"** (showing "Upstash" when deployed vs "Local" in dev, proving durable state on Vercel).
   - Choose whichever option the existing `/api/grants` response payload already supports. If `persistence.mode` is already returned (it is — check GrantStatusClient.tsx), then use the "Persistence" option and display "Upstash" vs "In-memory" based on the `persistence.mode` field, with a subtitle like "Grant history is durable across deploys." vs "Dev mode; history resets on restart."
   - Keep the card visually consistent with the other 3 metric cards.

4. **Run verification after the change:**
   - `npm run build` must pass.
   - If `node --test test/backend/statusPage.test.mjs` exists, run it and confirm it passes.

5. **Do NOT touch any other pages** (`/`, `/donor`, `/request`). This directive is scoped to `/status` only.

6. **Do NOT attempt the 7702 fix.** That is a separate task with a separate directive.

## Files to Reference
- `components/GrantStatusClient.tsx` — the component to modify
- `app/status/page.tsx` — the page wrapper (do not modify)
- `app/api/grants/route.ts` — check what fields the API already returns for persistence info

## Success Criteria
- The 4th metric card now shows meaningful persistence/webhook info instead of "Status log: Local"
- `npm run build` passes
- No other pages are affected
- The change is a single, clean commit
