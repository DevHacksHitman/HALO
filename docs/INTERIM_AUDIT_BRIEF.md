# Halo Interim Audit Brief

Date: 2026-06-04
Status: Interim reviewer packet, not a final security report.

## Verdict

CONDITIONAL GO to continue building.

NO-GO for live funds, live donor permissions, or live grant payouts until the open integration gates are closed.

Halo currently has a locally tested non-custodial architecture: contracts and backend helpers construct scoped caveats, ERC20 transfer executions, MetaMask permission requests, 1Shot relay request drafts, Venice/x402 verification payloads, and webhook status reducers. The current evidence is strong enough for an interim audit review, but not sufficient for production or real donor funds.

## Current Architecture

Halo is an autonomous mutual-aid fund demo built around scoped donor permissions.

- Donor grants a scoped periodic USDC permission through MetaMask Advanced Permissions.
- Halo Master Almoner constructs redelegation caveats for allowed sub-agents.
- Verifier Agent checks urgent requests with Venice and handles bounded x402 API-fee drafts.
- Treasurer Agent builds approved requester USDC payout drafts.
- 1Shot receives decoded ERC-7710 permission context plus USDC transfer executions.
- Grant status is tracked through append-only webhook events and a local `/status` dashboard.

Critical non-custody boundary:

- Halo contracts do not pool donor funds.
- USDC transfer execution target is the USDC token contract.
- The requester or Venice payee is encoded in ERC20 `transfer(address,uint256)` calldata and constrained by caveats.
- Live send is gated until an explicit live flag and real decoded permission context are available.

## Completed Build Steps

### Step 1: Foundry + Master Almoner

- Added Foundry project structure.
- Added `HaloAlmoner` and local caveat structs.
- Tested zero address rejection, rogue-agent rejection, verifier fee caps, treasurer grant caps, and caveat terms.

### Step 2: Verifier and Treasurer Solidity Helpers

- Added `HaloVerifier` and `HaloTreasurer`.
- Built bounded USDC transfer payload helpers.
- Tested zero token, zero recipient/paymaster, zero amount, and valid payload generation.

### Step 3: Backend Relay Draft Bridge

- Added backend bridge from Verifier/Treasurer intent to 1Shot relay draft.
- Preserved ERC20 target as USDC.
- Parsed recipient and amount from transfer calldata for auditability.
- Rejected missing decoded permission context before drafting a 1Shot request.

### Step 4: Next.js App Shell

- Added local routes: `/`, `/donor`, `/request`.
- Built donor/requester surfaces with judge-visible logs.
- Kept requester UX simple while exposing A2A, x402, and 1Shot technical evidence.

### Step 5: MetaMask Advanced Permission Request UI

- Added donor-side permission request builder.
- Uses Base Sepolia chain id `84532` and Base Sepolia USDC.
- Builds a scoped ERC20 periodic permission request.
- Serializes bigint USDC amounts to hex only at the wallet/RPC edge.
- No live permission grant is claimed yet.

### Step 6: 1Shot ERC-7710 Relay Wrapper

- Added 1Shot JSON-RPC request builders for:
  - `relayer_getCapabilities`
  - `relayer_getFeeData`
  - `relayer_estimate7710Transaction`
  - `relayer_send7710Transaction`
  - `relayer_getStatus`
- Uses `transactions[0].permissionContext + executions`.
- Blocks live send unless `HALO_ONESHOT_LIVE=1` or an explicit live option is passed.

### Step 7: Venice/x402 Verifier Flow

- Builds Venice receipt-verification requests.
- Requires the SIWX wallet-auth boundary.
- Parses strict JSON verification output.
- Rejects insufficient evidence and unsupported payment offers.
- Converts supported USDC x402 fees into capped 1Shot relay drafts.
- No live Venice spend is claimed yet.

### Step 8: Webhook Status Tracking

- Added `POST /api/webhooks/1shot`.
- Added `GET /api/grants`.
- Added `/status` dashboard.
- Normalizes 1Shot status values into Halo grant states.
- Keeps grant events append-only.
- Prevents late pending events from downgrading a paid grant.

### Step 9: Base Sepolia Deployment Readiness

- Added Base Sepolia deployment config validation.
- Validates RPC URL, private key shape, USDC token, Venice paymaster, and caveat enforcer addresses.
- Builds forge deployment command plan without printing secrets.
- Live broadcast remains separate from proof recording.

### Step 10: MetaMask Permission Context Capture

- Added donor-side inspection of the `requestExecutionPermissions` result.
- Summarizes context hash, byte length, delegation manager, and dependency count.
- Keeps captured hex context marked as not relay-ready.
- Keeps 1Shot estimate/send blocked until the context is decoded.

### Step 11: Decode Context + Base Sepolia 1Shot Estimate Request

- Uses `@metamask/smart-accounts-kit` delegation utilities to decode MetaMask permission context.
- Normalizes decoded delegations into the 1Shot-ready `permissionContext` array.
- Treats delegation `salt` as a JSON-RPC quantity.
- Builds a Base Sepolia `relayer_estimate7710Transaction` request.
- Keeps live send disabled.

### Step 12: Real Context Handoff

- Adds a donor UI handoff panel after permission capture.
- Keeps full wallet-returned context copyable locally.
- Redacts the full context from public UI previews and proof logs.
- Generates the private `HALO_METAMASK_PERMISSION_CONTEXT=...` command for the Step 11 estimate script.
- Keeps live 1Shot estimate/send as explicit opt-ins.

### Step 13: 1Shot Live Estimate Preflight

- Requires `HALO_METAMASK_PERMISSION_CONTEXT` before any 1Shot network estimate.
- Keeps Base Sepolia chain id `84532` explicit.
- Defaults to the 1Shot testnet relayer endpoint.
- Blocks accidental mainnet relayer endpoint usage unless explicitly allowed.
- Refuses the estimate preflight if `HALO_ONESHOT_LIVE=1`.
- Calls the live estimate endpoint only when `HALO_ONESHOT_ESTIMATE_LIVE=1` and the real context decodes.

### Step 14: Capped 1Shot Testnet Send Gate

- Requires `HALO_METAMASK_PERMISSION_CONTEXT` before any send gate can open.
- Requires `HALO_ONESHOT_ESTIMATE_RESULT` before any send gate can open.
- Re-checks the Treasurer grant cap before building the send request.
- Keeps Base Sepolia chain id `84532` explicit.
- Blocks accidental mainnet relayer endpoint usage.
- Builds `relayer_send7710Transaction` only after context, estimate, and cap checks pass.
- Runs network send only when `HALO_ONESHOT_LIVE=1`.

## Verification Evidence

Commands run on 2026-06-04:

```bash
npm run test:backend
forge test -vvv
npm run build
scripts/demo_step11_decode_estimate.sh
scripts/demo_step12_real_context_handoff.sh
scripts/demo_step13_live_estimate_preflight.sh
scripts/demo_step14_capped_send_gate.sh
```

Results:

- Backend tests: 51 passed, 0 failed.
- Foundry tests: 18 passed, 0 failed.
- Next.js production build: passed.
- Step 11 proof script: passed.
- Step 12 proof script: passed.
- Step 13 proof script: passed.
- Step 14 proof script: passed.
- Routes built: `/`, `/donor`, `/request`, `/status`, `/api/grants`, `/api/webhooks/1shot`.

Non-blocking note:

- Foundry emitted a local signature-cache warning because the sandbox could not write `/Users/apple/.foundry/cache/signatures`. Tests still passed.

## Open Live-Integration Gates

These must close before any real donor funds or public live-payout claim:

- Complete a real MetaMask permission request flow.
- Capture the returned MetaMask permission context and copy it through the Step 12 handoff.
- Confirm current 1Shot estimate response against the real decoded context.
- Run a capped testnet send only after estimate response and explicit live-send approval.
- Confirm Venice/x402 live auth and payment requirement shape with real SIWX credentials.
- Add provider-specific 1Shot webhook signature verification once the exact signing header is available.
- Configure real Venice paymaster and caveat enforcer addresses.
- Run a guarded Base Sepolia deployment with verified constructor args.
- Perform a small live test only after explicit approval and with capped testnet funds.

## Risk Register

### R1: Permission-context mismatch

Risk: MetaMask may return permission context in a different encoded shape than the current 1Shot wrapper expects.

Current mitigation: `buildOneShot7710Params` rejects encoded string context and requires a decoded delegation array. Step 11 uses the installed MetaMask Smart Accounts Kit delegation decoder before building the Base Sepolia estimate request. Step 12 redacts full context from public proof surfaces while keeping a private local handoff command. Step 13 separates live estimate from live send with explicit env gates. Step 14 requires an estimate receipt and re-checks the grant cap before any send request can run.

Auditor ask: Review the planned decode boundary and verify the delegation schema before live send.

### R2: Overclaiming live execution

Risk: Public posts or demo copy could imply live permission grants or live payouts before those have happened.

Current mitigation: X/HackQuest copy says "wired", "validated construction", and "no live permission grant claimed yet".

Auditor ask: Review public copy for any accidental "live payout" overclaim.

### R3: Caveat enforcement assumptions

Risk: Local caveat structs and terms prove shape, but final caveat enforcer contracts/addresses must match MetaMask/Delegation Toolkit behavior in live flow.

Current mitigation: Deployment script requires explicit enforcer addresses and refuses malformed config.

Auditor ask: Validate final enforcer addresses and caveat term encoding before deployment.

### R4: Webhook authenticity

Risk: Local webhook receiver normalizes status payloads but does not yet verify provider signatures.

Current mitigation: Brief and code treat this as local payload validation only.

Auditor ask: Add and test signature verification once the live 1Shot webhook signing scheme is confirmed.

### R5: Chain confusion

Risk: Posts, scripts, or screenshots could mix Ethereum Sepolia and Base Sepolia.

Current mitigation: Current config targets Base Sepolia, chain id `84532`, with Base Sepolia USDC.

Auditor ask: Check all submission copy and demo narration for Base Sepolia consistency.

### R6: Secret handling

Risk: Deploy flow could leak private key or RPC details in logs.

Current mitigation: Deploy config redacts private key and RPC URL in proof output; tests assert no private-key leakage.

Auditor ask: Review deploy script and final recording output before any public posting.

## Reviewer Questions

1. Are the non-custody claims technically accurate given the current contract and backend boundaries?
2. Is the ERC20 execution target/payee separation correctly represented in code and public materials?
3. Are the current caps for verifier fees and treasurer grants enforced in every relevant path?
4. Does the MetaMask permission request match the intended Advanced Permissions behavior for a scoped USDC periodic allowance?
5. Does the 1Shot request wrapper match the current public relayer shape closely enough for the next live estimate test?
6. Is the Base Sepolia deployment plan correctly separated from live broadcast?
7. What additional tests are required before a live testnet permission grant and relay?

## Recommended Next Step

Proceed to the next technical milestone only after this interim packet is reviewed for high-level correctness. Do not pause for a full final report yet.

Immediate next engineering focus:

- real MetaMask permission capture,
- decoded permission context inspection with the real returned context,
- live 1Shot estimate against real context,
- then a tightly capped live testnet send if the previous steps pass.
