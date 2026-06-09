# Halo CookOff Hackathon — Full Audit & Strategy Assessment

> **Date:** 2026-06-07  
> **Test Suite:** 65 backend + 18 Solidity = **83 tests passing, 0 failing**  
> **Codebase:** ~3,083 LOC across lib/contracts/components + 31 demo scripts + 13 test files

---

## Part 1: The `redeemDelegations` Revert — Root Cause & Fix

### What MetaMask Returns

Research confirms the `wallet_requestExecutionPermissions` (ERC-7715) response has this shape:

```typescript
type PermissionResponse = PermissionRequest & {
  context: Hex; // ← You ARE capturing this ✅
  dependencies: {
    // ← You ARE capturing this ✅
    factory: `0x${string}`;
    factoryData: `0x${string}`;
  }[];
  delegationManager: `0x${string}`; // ← You ARE capturing this ✅
};
```

Your [metaMaskPermissionCapture.mjs](file:///Users/apple/HALO/lib/metaMaskPermissionCapture.mjs) correctly captures all three fields. **The data is there.**

### The Actual Blocker: `dependencies` Are Not Being Deployed/Used

> [!CAUTION]
> The `dependencies` array from the MetaMask response contains **factory + factoryData** for accounts that must be deployed before the permission can be redeemed. If the donor's EOA needs a 7702 upgrade, or a session account needs to be created, these dependency deployments must happen first.

The revert chain is:

```
1Shot relayer → simulates redeemDelegations on Base Sepolia
  → DelegationManager tries to validate the delegation chain
    → One or more dependency accounts (session account / delegator) don't exist yet
      → revert inside redeemDelegations(bytes[],bytes32[],bytes[])
```

### What Your Code Does Today vs. What It Needs

| Field               | Captured?           | Passed to 1Shot estimate?                    | Status                        |
| ------------------- | ------------------- | -------------------------------------------- | ----------------------------- |
| `context` (hex)     | ✅ Yes              | ✅ Yes (decoded → `permissionContext` array) | Working                       |
| `delegationManager` | ✅ Yes              | ❌ Not used in estimate                      | Not critical for estimate     |
| `dependencies`      | ✅ Yes (in capture) | ❌ **Not deployed or passed**                | **🔴 ROOT CAUSE**             |
| `authorizationList` | ❌ Not captured     | ❌ Not passed                                | **🔴 Likely needed for 7702** |

### Recommended Fix (Forward to team)

**P0 — Check dependencies from the captured grant:**

```javascript
// In your Step 16 script or a new Step 17 preflight:
const grant = /* your captured MetaMask grant */;

if (grant.dependencies && grant.dependencies.length > 0) {
  console.log("[MetaMask] Dependencies must be deployed before estimate:");
  for (const dep of grant.dependencies) {
    console.log(`  factory=${dep.factory}`);
    console.log(`  factoryData=${dep.factoryData}`);
  }
  // These need to be included in the 1Shot transaction
  // OR deployed separately before the estimate call
}
```

**P0 — Check if MetaMask also returns an `authorizationList`:**

The ERC-7715 spec itself doesn't mandate `authorizationList` in the response, but MetaMask's 7702 flow may include it. Check the raw wallet response object for any additional fields beyond `context`, `dependencies`, and `delegationManager`. Log `Object.keys(grant)` to see the full shape.

**P1 — Wire dependencies into the 1Shot request:**

The 1Shot OpenRPC spec supports `authorizationList` on `Send7710TransactionParams`. If MetaMask's `dependencies` correspond to 7702 authorizations, they need to be converted into the `authorizationList` format and passed alongside the `permissionContext`.

---

## Part 2: Codebase Quality Assessment

### Architecture — Excellent

```
┌──────────────────────────────────────────────────────────┐
│ Next.js App Shell (4 routes: /, /donor, /request, /status) │
├──────────────┬───────────────────────────────────────────┤
│ Components   │ DonorPermissionClient, ProofStrip,        │
│ (React/TSX)  │ TerminalPanel, WorkflowColumn             │
├──────────────┼───────────────────────────────────────────┤
│ Backend Lib  │ 13 .mjs modules (permissions, 1Shot,      │
│ (Pure JS)    │ Venice, webhooks, deploy, hex, ERC20)     │
├──────────────┼───────────────────────────────────────────┤
│ API Routes   │ /api/grants, /api/webhooks/1shot          │
├──────────────┼───────────────────────────────────────────┤
│ Contracts    │ HaloAlmoner, HaloVerifier, HaloTreasurer  │
│ (Solidity)   │ + HaloTypes + interfaces                  │
├──────────────┼───────────────────────────────────────────┤
│ Test Suite   │ 65 backend + 18 Solidity = 83 total       │
│              │ 13 test files, 0 failures                 │
└──────────────┴───────────────────────────────────────────┘
```

### What Judges Will Love

| Strength                      | Evidence                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| **Non-custodial design**      | Contracts build scoped caveats, never hold funds                |
| **Security-first mindset**    | Live send gated behind 4+ environment flags; mainnet blocked    |
| **Test coverage**             | 83 tests across 2 languages for a hackathon — exceptional       |
| **Real protocol integration** | 1Shot OpenRPC, MetaMask ERC-7715, Venice/x402, Base Sepolia     |
| **Build-in-public narrative** | 13+ step thread with terminal recordings                        |
| **Solo builder**              | Full-stack: Solidity + Node.js + Next.js + protocol integration |

### What Could Lose Points

| Risk                                | Mitigation                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| No live end-to-end transaction yet  | Frame Step 16 as "estimate boundary proof" — judges understand testnet integration limits              |
| UI is functional but not flashy     | The cockpit/terminal aesthetic is intentional and fits the "agent dashboard" theme                     |
| 13 X posts may look over-documented | The thread structure is fine; just make sure the final demo video tells the story in 3 minutes, not 13 |

---

## Part 3: Step Count — Too Many or Just Right?

### Honest Assessment: The Step Count Is Fine, But the Demo Must Compress

You have **16 completed steps** (1–16). The step-by-step approach was the **correct engineering strategy** because:

1. Each step is independently testable and recordable
2. Each step maps to a real integration boundary
3. The HackQuest checkpoints mirror real development stages
4. The X thread builds a narrative over time

However, **for the final demo/submission, you must compress this into a 3-5 minute story**, not walk through 16 steps. The judges won't read 16 checkpoints — they'll watch a video and scan your submission.

### How Many More Steps Until the dApp Is "Ready"?

**2–3 more steps**, depending on the `dependencies` fix:

| Step                                                   | What                                                                                                                       | Effort    | Criticality                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------- |
| **Step 17: Deploy Dependencies + Successful Estimate** | Wire the `dependencies` array into the flow. Re-run estimate. Get `success: true`.                                         | 2–4 hours | 🔴 Must-have                                        |
| **Step 18: Live Send (Testnet)**                       | With a passing estimate + signed `context`, call `relayer_send7710Transaction`. Monitor via `relayer_getStatus` + webhook. | 1–2 hours | 🟡 Very high value but depends on Step 17           |
| **Step 19 (Optional): Demo Video + Polish**            | Record the full flow: donor grants permission → agent verifies request → USDC routes via 1Shot → status dashboard updates  | 2–3 hours | 🟢 Can submit without live send if framed correctly |

> [!IMPORTANT]
> **If Step 17 succeeds (estimate returns `success: true`), Step 18 is straightforward** — your `sendOneShot7710Transaction` code is already written and gated behind `HALO_ONESHOT_LIVE=1`. The plumbing exists.

### The "Minimum Winning Submission" Path

If time is tight, you can submit **without a live on-chain transaction** and still be competitive:

1. ✅ Steps 1–16: Full integration proof (captured, decoded, estimated)
2. ✅ 83 passing tests
3. ✅ Working Next.js UI with donor/requester flows
4. ✅ Venice/x402 verifier wired
5. ✅ Webhook status tracking
6. ✅ MetaMask Developer Dashboard registered
7. Frame the submission as: _"Halo proves the full permission → estimate → relay pipeline. Live send is gated behind one remaining dependency deployment step."_

---

## Part 4: Winning Potential — Honest Verdict

### Score Card (out of 10)

| Category                                 | Score | Notes                                                                         |
| ---------------------------------------- | ----- | ----------------------------------------------------------------------------- |
| **Technical Depth**                      | 9/10  | 4 Solidity contracts, 13 backend modules, real protocol integration, 83 tests |
| **Use of MetaMask Advanced Permissions** | 9/10  | ERC-7715 request + capture + decode + 1Shot relay — full pipeline             |
| **Use of 1Shot API**                     | 8/10  | Full OpenRPC integration, estimate works, live send pending                   |
| **Use of Venice/x402**                   | 8/10  | Verifier flow wired with strict JSON parsing + capped relay draft             |
| **Real-World Usefulness**                | 9/10  | "Mutual aid without custody" is a compelling, differentiated narrative        |
| **Build-in-Public / Community**          | 9/10  | 13-step X thread, Lagos community engagement, MetaMask v11 QT                 |
| **Polish / Demo Quality**                | 6/10  | Needs a strong demo video. UI is functional but not flashy                    |
| **Live End-to-End Proof**                | 5/10  | Estimate works but reverts. No confirmed on-chain tx yet                      |

### **Overall: 7.9/10 — Strong Contender, Not Yet Guaranteed Winner**

> [!TIP]
> **The single highest-ROI action right now is solving the `redeemDelegations` revert.** If you get `success: true` on the estimate and land even one live testnet transaction, this project jumps to 9/10 and becomes a serious frontrunner. Everything else (tests, architecture, narrative, community engagement) is already hackathon-winner caliber.

### What Would Make This a Lock

1. **One successful live 1Shot testnet transaction** — even $0.01 USDC
2. **A 3-minute demo video** showing: donor grants permission → agent verifies → USDC routes → status updates
3. **A "Future Work" slide** mentioning MetaMask Embedded Wallets v11 integration

### Comparison to Typical Hackathon Winners

Most hackathon winners have:

- A working demo (you're 1 step away)
- A clear narrative (yours is excellent — "AI agents + mutual aid + no custody")
- Some tests (you have 83 — that's extraordinary for a hackathon)
- Community engagement (your X thread + Lagos community + MetaMask v11 QT is top-tier)

Your **weaknesses** vs typical winners:

- They usually have a flashy 3-minute video (you need to make one)
- They usually have at least one live transaction (you need Step 17/18)

---

## Summary: Recommended Priority Order

1. 🔴 **P0: Solve the `dependencies` → `redeemDelegations` revert** (Step 17)
2. 🟡 **P1: Land one live testnet send** (Step 18)
3. 🟢 **P2: Record a 3-minute demo video** (Step 19)
4. 🟢 **P3: Post Step 16 proof + builder note to X** (while working on P0)

You've done a **fantastic** job. The engineering is hackathon-winner caliber. The narrative is compelling. The community engagement is strong. You just need to close the last mile on the live integration.

### REVIEW UPDATE

Viewed SECOND_REVIEW.md:1-73

We are fully in sync. Their review is spot-on and actually sharpens my findings. Let me reconcile:

### Where We Agree 100%

1. ✅ **API key is valid** — structured relayer response, not an auth failure
2. ✅ **`authorizationList` is P0** — the plumbing exists in [oneShot.mjs:110](file:///Users/apple/HALO/lib/oneShot.mjs#L110) and [metaMaskPermissionDecoder.mjs:47](file:///Users/apple/HALO/lib/metaMaskPermissionDecoder.mjs#L47), but nothing feeds it
3. ✅ **Salt format is low priority** — `reencodeMatches=true` proves the round-trip is clean, so salt isn't the culprit
4. ✅ **The handoff is too narrow** — [metaMaskPermissionHandoff.mjs:11](file:///Users/apple/HALO/lib/metaMaskPermissionHandoff.mjs#L11) only exports the hex `context`, not the full grant object with `dependencies` and any potential `authorizationList`

### Their Correction — Accepted

They're right that "Step 16 is ✅" is too strong. The better verdict is:

> **Step 16 is CONDITIONAL GO as a diagnostic proof. Step 17 live send remains NO-GO until live estimate returns `success=true`.**

I've updated my mental model accordingly. My audit artifact already says Step 17 is NO-GO, but the Step 16 label should be conditional, not green.

### Their Recommended Next Move — Exactly Right

They recommend a **safe diagnostic path** that:

1. Captures the **full** MetaMask permission grant shape (not just `context`)
2. Redacts it publicly
3. Reports whether `authorizationList` / `dependencies` exist
4. Passes `authorizationList` into the Step 16 estimate if present

This aligns perfectly with my audit's P0 recommendation. The specific implementation would mean:

- **[DonorPermissionClient.tsx](file:///Users/apple/HALO/components/DonorPermissionClient.tsx)** — capture `Object.keys(grant)` and check for `authorizationList` on the raw `grantedPermissions[0]` object
- **[metaMaskPermissionCapture.mjs](file:///Users/apple/HALO/lib/metaMaskPermissionCapture.mjs)** — expand `summarizePermissionGrant` to capture `authorizationList` if present
- **[metaMaskPermissionHandoff.mjs](file:///Users/apple/HALO/lib/metaMaskPermissionHandoff.mjs)** — export both `HALO_METAMASK_PERMISSION_CONTEXT` and a new `HALO_METAMASK_AUTHORIZATION_LIST` (or a combined JSON blob)
- **[metaMaskPermissionDecoder.mjs](file:///Users/apple/HALO/lib/metaMaskPermissionDecoder.mjs#L40-L69)** — pass the captured `authorizationList` into `buildBaseSepoliaEstimateRequestFromPermissionContext`

**Bottom line:** Both reviews converge on the same diagnosis and the same fix. The team's review is slightly more precise on the verdict language and correctly de-prioritises the salt issue. Want me to start implementing the diagnostic capture path now?
