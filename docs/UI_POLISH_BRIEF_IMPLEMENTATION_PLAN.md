# Halo UI Polish Implementation Plan

This plan details how we will execute the UI Polish Brief (`docs/UI_POLISH_BRIEF.md`) to transform the frontend into a "serious grant operations console" without altering protocol semantics.

## User Review Required

Please review the proposed CSS and component structural changes to confirm they align with the desired "quiet operational palette" and "evidence-first" approach. Note that NO fake data will be introduced, and `PAID` state will remain gated behind verified webhook/relayer status.

## Open Questions

- The `DemoCockpitClient.tsx` currently has a `proof-rail` grid. We will style it horizontally. Should it remain at the top of the Home page, or be moved underneath the grant status?

## Proposed Changes

---

### Global Styling

#### [MODIFY] [globals.css](file:///Users/apple/HALO/app/globals.css)

- **Palette enforcement:** Ensure the quiet palette (`--halo-sage`, `--halo-mint`, `--halo-surface`) is strictly applied. Remove any accidental gradients or drop shadows.
- **Tight Borders & Cards:** Standardize border radius to `8px`. Use compact spacing.
- **State Badges:** Enhance `.status-card` and `.permission-status` with explicit semantic coloring (e.g., `ready`, `shadow`, `confirmed`).
- **Proof Rail:** Refine the `.proof-rail` layout to flow sequentially (horizontal on desktop, stacking gracefully on mobile).

---

### Home Page & Cockpit

#### [MODIFY] [page.tsx](file:///Users/apple/HALO/app/page.tsx)

- Streamline the hero section. Remove oversized headings. Ensure the cockpit (actual product loop) is immediately visible without scrolling.

#### [MODIFY] [DemoCockpitClient.tsx](file:///Users/apple/HALO/components/DemoCockpitClient.tsx)

- Ensure the Proof Rail (`MetaMask -> Venice -> x402 -> A2A -> 1Shot status`) is visually linked and features the exact boundary labels (`live verifier`, `shadow only`, `local proof`, `confirmed paid`).
- Ensure Base Sepolia boundary is explicitly tagged.

---

### Donor Flow

#### [MODIFY] [donor/page.tsx](file:///Users/apple/HALO/app/donor/page.tsx)

- Remove explanatory paragraphs. Make it feel like an operational console.

#### [MODIFY] [DonorPermissionClient.tsx](file:///Users/apple/HALO/components/DonorPermissionClient.tsx)

- Refactor the `.permission-summary` layout to be ultra-compact. Use icons where appropriate.
- Ensure `authorizationList` presence, dependency count, and redacted context are displayed in dense, data-heavy rows instead of standard text.

---

### Request & Verifier Flow

#### [MODIFY] [request/page.tsx](file:///Users/apple/HALO/app/request/page.tsx)

- Ensure the copy is dignified and operational, not a "charity ad".

#### [MODIFY] [RequesterAgentClient.tsx](file:///Users/apple/HALO/components/RequesterAgentClient.tsx)

- Render the `x402 shadow` and `A2A redelegation` proofs as distinct "boundary cards" rather than executable buttons or payment claims.
- Show receipt evidence preview and Venice verifier result explicitly.

---

### Status Tracking

#### [MODIFY] [status/page.tsx](file:///Users/apple/HALO/app/status/page.tsx)

- Ensure the status source of truth is explicit (Webhook vs Local).

#### [MODIFY] [GrantStatusClient.tsx](file:///Users/apple/HALO/components/GrantStatusClient.tsx)

- Segregate Step 21/22/23 proofs into a "shadow / proof" section so they cannot be confused with live `PAID` state.
- Ensure balance reconciliation and timestamps are strictly factual.

## Verification Plan

### Manual Verification

- **Visual Audit:** Run the Next.js app locally (`npm run dev`) and inspect Home, Donor, Request, and Status screens on desktop and mobile.
- **Semantics Audit:** Verify that no secret contexts leak, and `PAID` is only shown when the real `api/grants` returns confirmed state.
- **Proof Rail Audit:** Ensure all 5 steps in the rail use the exact requested boundary labels.
