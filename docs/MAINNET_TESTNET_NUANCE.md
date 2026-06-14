# Mainnet And Testnet Nuance

## Verdict

**CONDITIONAL GO for a Base Sepolia final demo. NO-GO for claiming the 1Shot mainnet prize path is fully complete unless Step 24/25 pass on Base mainnet.**

Halo should keep the final hackathon demo centered on the proven Base Sepolia loop:

- MetaMask Advanced Permissions / Smart Accounts Kit in the main application flow.
- 1Shot relay execution and terminal status proof on Base Sepolia.
- Signed/status-gated `/status=PAID` semantics.
- Live Venice verifier output.
- Venice x402 payment-requirement discovery in shadow mode.
- A2A redelegation proof with chain length `>=2`.

Mainnet remains a production-readiness gate, not the default deadline path.

## Current Proven State

| Area | Current state | Demo claim allowed |
| --- | --- | --- |
| 1Shot relay | Step 20 proved Base Sepolia send, TaskId, `relayer_getStatus=200`, tx hash, `/status=PAID`, and balance reconciliation | "Base Sepolia 1Shot relay/status proof" |
| Venice verifier | Step 21 used live Venice API credits and returned structured grant reasoning | "Live Venice verifier proof" |
| Venice x402 | Step 22 captured the real x402 payment requirement without settlement | "x402 shadow discovery" |
| A2A | Step 23 proved local redelegation chain length `>=2` for Verifier and Treasurer lanes | "A2A redelegation proof" |
| Mainnet | Step 24 is implemented as a strict preflight gate; Step 25 is future live send | "Mainnet readiness gate implemented" |

## The Hackathon Nuance

The general HackQuest demo expectations are satisfied by showing a working application flow that uses MetaMask Smart Accounts Kit or Advanced Permissions, plus clear use of 1Shot and Venice where relevant.

The **Best Use of 1Shot Permissionless Relayer** prize has a harder caveat: the sponsor wording points to the 1Shot permissionless **mainnet** relayer and 7702 authorization readiness. Halo should not imply that Base Sepolia alone fully satisfies that prize-specific mainnet condition.

Correct public framing:

> Halo proves the end-to-end relay/status loop on Base Sepolia and keeps Base mainnet execution behind a strict Step 24/25 production gate.

Incorrect public framing:

> Halo is fully mainnet deployed.

> The 1Shot mainnet prize path is complete.

> 7702 is handled automatically by the relayer with no wallet-side readiness requirement.

## 7702 Boundary

Do not claim the relayer magically handles 7702 setup by itself. The live mainnet path needs at least one real readiness route:

- account code already present and matching the expected MetaMask 7702 delegator path,
- wallet-supplied `authorizationList`,
- or deployable/deployed Smart Accounts Kit dependencies.

If none of those are present, Step 24 must remain **NO-GO**.

## Mainnet Archive

Mainnet is not abandoned. It is archived in the repo as the production deployment lane:

- Step 24: Base mainnet preflight only, no send.
- Step 25: guarded Base mainnet send only after Step 24 is clean.

Step 25 still requires:

- funded Base mainnet wallet,
- Base mainnet USDC,
- production 1Shot relayer target,
- A2A chain length `>=2`,
- 7702 readiness,
- fee/grant caps satisfied,
- real HTTPS webhook URL,
- `HALO_MAINNET_DEMO_ARMED=1`,
- explicit live-send approval.

## No Token Launch

Halo should not introduce a token-launch narrative for this hackathon. It weakens the product story and distracts from the humanitarian grant loop.

Better post-hackathon framing:

- mainnet deployment,
- stronger fraud-resistant verification,
- recurring donor caps,
- signed webhook hardening,
- richer A2A policy lanes,
- optional governance or reputation later.

## Recommended Deadline Strategy

1. Use Base Sepolia as the final video execution lane.
2. Show Step 20 as the paid relay/status proof.
3. Show Step 21 as the live Venice intelligence proof.
4. Show Step 22 as x402 payment-boundary discovery.
5. Show Step 23 as A2A redelegation proof.
6. Mention Step 24/25 as the mainnet gate, not as completed mainnet execution.
7. Do not run Step 25 unless Step 24 is clean and the user explicitly approves a mainnet send.

## Public Claim Matrix

| Evidence | Allowed wording | Blocked wording |
| --- | --- | --- |
| Step 20 status `200` | "paid/status confirmed on Base Sepolia" | "mainnet paid" |
| Step 21 response `200` | "live Venice verifier used" | "x402 settled" |
| Step 22 status `402` | "x402 payment requirement captured" | "USDC spent" |
| Step 23 chain length `>=2` | "A2A redelegation proof" | "onchain A2A execution" |
| Step 24 clean preflight | "mainnet preflight passed, no send" | "mainnet payout complete" |
| Step 25 status `200` | "mainnet paid/status confirmed" | allowed only after it actually happens |
