# Halo Mentor Checkpoints

Use these after each build milestone so the public journey and judge Q&A stay technically precise.

## Step 6: 1Shot ERC-7710 Relay Wrapper

### Checklist

- [x] Build current `relayer_send7710Transaction` request shape.
- [x] Use `transactions[0].permissionContext + executions`.
- [x] Keep EVM target as the USDC token contract.
- [x] Encode requester/Venice recipient inside ERC20 `transfer` calldata.
- [x] Block live send unless explicitly enabled.

### Q&A

Q: Is Step 6 a live payment?
A: No. Step 6 proves validated relay construction. Live send waits for a real decoded MetaMask permission context, a fresh 1Shot estimate, and explicit live-send enablement.

Q: Why is the transaction target USDC instead of the requester or Venice?
A: ERC20 transfers execute on the token contract. The payee is encoded in the `transfer(address,uint256)` calldata and constrained by caveats.

## Step 7: Venice/x402 Verifier Flow

### Checklist

- [x] Build Venice chat-completion request for receipt verification.
- [x] Require wallet-auth boundary via `X-Sign-In-With-X`.
- [x] Parse strict JSON verification results.
- [x] Reject invalid or insufficient receipt evidence.
- [x] Parse x402 top-up payment requirements.
- [x] Convert supported USDC x402 payment offer into a capped 1Shot relay draft.

### Q&A

Q: Does Step 7 spend against Venice?
A: No. It proves the verifier request and x402 payment boundary locally. Live Venice spend waits for real SIWX auth and decoded MetaMask permission context.

Q: What is the Verifier Agent allowed to spend?
A: Only the capped verifier fee amount. In the current tests, x402 fees above `2_000_000` USDC atoms are rejected before any relay draft is built.

## Step 8: Webhook Status Tracking

### Checklist

- [x] Add `POST /api/webhooks/1shot` for local 1Shot status callbacks.
- [x] Add `GET /api/grants` for current grant status.
- [x] Add `/status` dashboard route.
- [x] Normalize 1Shot statuses into Halo grant states.
- [x] Keep grant events append-only.
- [x] Prevent late pending events from downgrading a paid grant.

### Q&A

Q: Is the Step 8 webhook receiver production-secure?
A: Not yet. It validates payload shape locally. Provider-specific signature verification is deferred until the exact 1Shot webhook signing header is available in live setup.

Q: Why append-only events?
A: Append-only state lets judges and operators audit how a grant moved from verification to relay to paid or failed. It avoids hiding a bad webhook or race condition.

## Step 9: Base Sepolia Deployment Readiness

### Checklist

- [x] Keep target chain explicit: Base Sepolia, chain id `84532`.
- [x] Validate deploy RPC, private key shape, paymaster address, and caveat enforcer addresses.
- [x] Build forge deployment command plan without printing secrets.
- [x] Add a live deployment script that refuses to run with missing or malformed env.
- [x] Keep live broadcast separate from the proof recording.

### Q&A

Q: Are we deploying to Ethereum Sepolia or Base Sepolia?
A: Base Sepolia. Halo currently uses chain id `84532`, Base Sepolia USDC, and the 1Shot/MetaMask path we have been testing around Base-compatible Smart Account flows.

Q: Why not broadcast immediately?
A: Because live deploy needs final real addresses for the Venice paymaster and caveat enforcers. The proof script validates readiness without risking a bad on-chain deployment.

## Step 10: MetaMask Permission Context Capture

### Checklist

- [x] Capture and validate the `requestExecutionPermissions` grant shape.
- [x] Summarize context hash, byte length, delegation manager, and dependency count.
- [x] Mark captured context as hex-only and not relay-ready.
- [x] Keep 1Shot estimate/send blocked until the context is decoded into a delegation array.
- [x] Add regression tests for malformed grant context and dependency payloads.

### Q&A

Q: Does Step 10 make Halo ready for live 1Shot send?
A: No. Step 10 proves the capture and inspection boundary. The captured MetaMask context is still hex-encoded; 1Shot estimate/send waits for a decoded delegation array.

Q: Why capture the context before decoding?
A: It creates an auditor-visible checkpoint between wallet permission grant and relayer execution. That makes the next integration step easier to debug and prevents accidental raw-hex context from reaching 1Shot.

## Step 11: Decode Permission Context + 1Shot Estimate Request

### Checklist

- [x] Decode MetaMask permission context with `@metamask/smart-accounts-kit` delegation utilities.
- [x] Normalize decoded delegations into the 1Shot-ready `permissionContext` array.
- [x] Treat delegation `salt` as a JSON-RPC quantity, not byte data.
- [x] Build a Base Sepolia `relayer_estimate7710Transaction` request.
- [x] Keep live send disabled.
- [x] Add fixture mode plus `HALO_METAMASK_PERMISSION_CONTEXT` override for a real wallet grant.

### Q&A

Q: Is Step 11 a live 1Shot estimate?
A: Not by default. Step 11 proves the decoder and Base Sepolia estimate request boundary locally. A live estimate still needs a real wallet-returned permission context and explicit approval.

Q: What changed from Step 10?
A: Step 10 captured and inspected the hex context. Step 11 decodes that hex into the delegation array shape that 1Shot expects before estimate/send.

Q: Why does salt become `0x1` instead of `0x01`?
A: Delegation salt is an integer quantity at the JSON-RPC boundary. `0x1` is the canonical quantity form; `0x01` is byte-data style and can cause schema mismatch.

## Step 12: Real Context Handoff

### Checklist

- [x] Add a donor UI handoff panel after MetaMask permission capture.
- [x] Keep the full wallet-returned context copyable locally.
- [x] Redact the full context from public UI previews and proof logs.
- [x] Generate the private `HALO_METAMASK_PERMISSION_CONTEXT=...` estimate command.
- [x] Prove the handoff can feed the Step 11 decoder and Base Sepolia estimate request.
- [x] Keep live 1Shot estimate/send as explicit opt-ins.

### Q&A

Q: Why redact the permission context if it is not a private key?
A: The context can be a bearer-style execution artifact for a scoped delegation. It is safer to treat the full value as local-only and show only previews in public recordings.

Q: Does Step 12 run the real 1Shot estimate?
A: No. Step 12 prepares the real-context handoff path. A live estimate still requires a real wallet-returned context plus explicit opt-in.

## Step 13: 1Shot Live Estimate Preflight

### Checklist

- [x] Require `HALO_METAMASK_PERMISSION_CONTEXT` before any network estimate.
- [x] Keep Base Sepolia chain id `84532` explicit.
- [x] Default to the 1Shot testnet relayer endpoint.
- [x] Block accidental mainnet relayer endpoint usage unless explicitly allowed.
- [x] Refuse estimate preflight if `HALO_ONESHOT_LIVE=1`.
- [x] Run a live estimate only when `HALO_ONESHOT_ESTIMATE_LIVE=1` and the real context decodes.

### Q&A

Q: Is Step 13 a live estimate?
A: Not by default. Step 13 is the live-estimate gate. It only calls the 1Shot network when the real MetaMask context exists and `HALO_ONESHOT_ESTIMATE_LIVE=1`.

Q: Why block if `HALO_ONESHOT_LIVE=1`?
A: Estimate and send are separate safety stages. During Step 13, live send must stay off so an estimate test cannot accidentally become a relay execution.

## Step 14: Capped 1Shot Testnet Send Gate

### Checklist

- [x] Require `HALO_METAMASK_PERMISSION_CONTEXT` before any send gate can open.
- [x] Require a prior `HALO_ONESHOT_ESTIMATE_RESULT` before any send gate can open.
- [x] Re-check the Treasurer grant cap before building the send request.
- [x] Keep Base Sepolia chain id `84532` explicit.
- [x] Block accidental mainnet relayer endpoint usage.
- [x] Build the `relayer_send7710Transaction` request only after context, estimate, and cap checks pass.
- [x] Run network send only when `HALO_ONESHOT_LIVE=1`.

### Q&A

Q: Is Step 14 a live payout?
A: No. Step 14 is the final send gate. It proves Halo will not send until real context, a prior estimate, cap checks, and the explicit live-send flag are all present.

Q: Why require the estimate result separately?
A: It prevents a direct jump from permission capture to send. The estimate becomes an operator checkpoint before any delegated execution can leave the app.

## Step 15: Webhook Signature Gate

### Checklist

- [x] Add Ed25519 verification for signed 1Shot webhook payloads.
- [x] Ignore the `signature` field when building the canonical signed payload.
- [x] Reject tampered callback payloads when a public key is configured.
- [x] Keep unsigned local demo callbacks available by default.
- [x] Add `ONESHOT_WEBHOOK_PUBLIC_KEY` and `ONESHOT_WEBHOOK_SIGNATURE_REQUIRED` live-mode knobs.
- [x] Wire the signature check into `POST /api/webhooks/1shot` before grant status updates.

### Q&A

Q: Does Step 15 make the webhook fully production-final?
A: It adds the verification gate and tests the Ed25519 path. The final live check is confirming the exact 1Shot webhook public key and signed payload canonicalization against a real callback.

Q: Why allow unsigned local callbacks at all?
A: Local proof scripts and screenshots need deterministic webhook samples. Live mode can require signatures by setting `ONESHOT_WEBHOOK_SIGNATURE_REQUIRED=1` and `ONESHOT_WEBHOOK_PUBLIC_KEY`.

Q: Should the live signature flags be enabled now?
A: No. Keep `ONESHOT_WEBHOOK_SIGNATURE_REQUIRED=0` until the real 1Shot webhook public key and signed payload canonicalization are confirmed. Enabling required mode with no public key would make local status callbacks fail closed.

## Step 16: Real Permission Context Estimate Rehearsal

### Checklist

- [x] Capture a real MetaMask `requestExecutionPermissions` context from the donor UI.
- [x] Keep the full context in local env only; do not print it in public recordings.
- [x] Load root `.env.local` silently from the Step 16 proof script.
- [x] Decode the wallet-returned context into a 1Shot-ready delegation array.
- [x] Confirm the decoded context re-encodes to the same hash.
- [x] Build a Base Sepolia `relayer_estimate7710Transaction` request.
- [x] Keep `HALO_ONESHOT_LIVE=0` so no relay send can run.
- [x] Treat `HALO_ONESHOT_ESTIMATE_LIVE=1` as a separate opt-in for the network estimate.

### Q&A

Q: What did Step 16 prove?
A: The real wallet-returned MetaMask permission context can be decoded, normalized, and shaped into a Base Sepolia 1Shot estimate request without exposing the raw context or sending a relay transaction.

Q: Is Step 16 a live payout?
A: No. Step 16 is either a dry-run estimate rehearsal or, with `HALO_ONESHOT_ESTIMATE_LIVE=1`, a live estimate call only. `HALO_ONESHOT_LIVE` remains `0`, so no 1Shot send is attempted.

Q: What is the current Step 16 status?
A: The dry-run passed, then the live 1Shot estimate succeeded on Base Sepolia with `success=true`, a redacted estimate summary, and `HALO_ONESHOT_LIVE=0`. No relay send was attempted.

Q: What comes after Step 16?
A: Step 17 checks the full MetaMask grant for deployable dependencies. Step 18 then rehearses the live-send gate by requiring a fresh successful estimate, returned estimate context, exact fee match, and explicit `HALO_ONESHOT_LIVE=1` before any testnet send.

## Step 17: Full Grant Dependency Preflight

### Checklist

- [x] Accept the full MetaMask permission grant JSON locally without printing raw context.
- [x] Report safe grant shape diagnostics: keys, dependency count, dependency hashes, and authorizationList presence.
- [x] Detect deployable dependencies without passing them blindly to 1Shot.
- [x] Build dependency deployment transaction plans from `factory` + `factoryData` when dependencies exist.
- [x] Keep dependency deployment in the connected wallet UI path, not a private-key terminal script.
- [x] Block estimate/send when dependencies exist but deployment txs are missing.
- [x] Confirm the current Base Sepolia grant returned no deployable dependencies.

### Q&A

Q: Did Step 17 require dependency deployment?
A: No. The current MetaMask Flask Base Sepolia grant returned `dependencies=0` and no `authorizationList`, so there was nothing to deploy before the successful 1Shot estimate.

Q: Why not pass dependencies into 1Shot?
A: ERC-7715 dependencies are deployable account setup calls. If the wallet returns them, Halo should deploy each dependency by calling `factory` with `factoryData` through the connected wallet, then rerun estimate.

Q: Does Step 17 make live send safe?
A: Not by itself. It clears the grant-dependency question. Step 18 still requires a fresh successful 1Shot estimate, quote context, exact fee match, and explicit live-send enablement.

## Step 18: Live-Send Rehearsal Gate

### Checklist

- [x] Run a fresh 1Shot estimate immediately before any send rehearsal.
- [x] Require the estimate to return `success=true`.
- [x] Require the estimate-returned context before building `relayer_send7710Transaction`.
- [x] Require a 1Shot fee payment plan.
- [x] Block send if the planned USDC fee payment differs from estimate `requiredPaymentAmount`.
- [x] Keep `HALO_ONESHOT_LIVE=0` for public proof recordings unless a live testnet send is explicitly approved.
- [x] Redact raw MetaMask context, raw estimate context, and API key from logs.

### Q&A

Q: Is Step 18 a live payout?
A: Not in the default proof. With `HALO_ONESHOT_LIVE=0`, Step 18 proves the send gate and shows whether the relayer send request is ready. No network send is attempted.

Q: What opens the live-send gate?
A: A real permission context, a fresh successful Base Sepolia estimate, returned estimate context, exact fee payment match, and `HALO_ONESHOT_LIVE=1`.

Q: Why require the planned fee to match `requiredPaymentAmount` exactly?
A: The relayer estimate is the quote boundary. Step 18 prevents using an old or oversized fee execution when the relayer says the required payment is a different amount.

Q: What happens after a live testnet send returns a task id?
A: Halo should poll relayer status and wait for a signed webhook/status update before marking any grant paid.

## Step 19: Relay Send + Status Confirmation Gate

### Checklist

- [x] Reuse the Step 18 fresh-estimate and exact-fee send gate.
- [x] Keep the public proof path at `HALO_ONESHOT_LIVE=0` unless live testnet send is explicitly approved.
- [x] Add `relayer_getStatus` support for returned 1Shot task ids.
- [x] Redact raw task id and transaction hash from terminal proof logs.
- [x] Classify relayer status into Halo grant states without marking paid early.
- [x] Poll relayer status only after a live send returns a task id.
- [x] Keep signed webhook confirmation as the final paid-state boundary.

### Q&A

Q: Is Step 19 a live payout by default?
A: No. The safe proof runs a fresh estimate and confirms the send/status path, but leaves `HALO_ONESHOT_LIVE=0`, so no relay send is attempted.

Q: What changes if `HALO_ONESHOT_LIVE=1` is explicitly approved?
A: The script can submit the Base Sepolia relay send, redact the returned task id, poll `relayer_getStatus`, and normalize the relayer status into Halo grant status.

Q: When can Halo publicly claim a grant is paid?
A: Only after relayer status or a signed webhook confirms success. A task id alone means submitted/trackable, not paid.

Q: Why hash task ids and transaction hashes in recordings?
A: It keeps the public proof audit-friendly without turning the build thread into a live operational dashboard. Raw ids can stay local for debugging and explorer checks.

## Step 20: Relay Reconciliation Boundary

### Checklist

- [x] Reuse the fresh-estimate and exact-fee live-send gate from Steps 18 and 19.
- [x] Read pre/post Base Sepolia USDC balances only through redacted hashes and atom deltas.
- [x] Handle direct-string, object, null, and missing 1Shot send responses.
- [x] Poll relayer status only when a TaskId is returned.
- [x] Treat matching balance movement without TaskId/status as a reconciliation issue, not a paid claim.
- [x] Block public paid claims unless relayer status or a signed webhook confirms success.
- [x] Keep raw MetaMask context, estimate context, task id, tx hash, API key, and wallet addresses out of public logs.

### Q&A

Q: Why add Step 20 after Step 19?
A: Step 19 opened the live-send path, but the send response did not return a TaskId. Step 20 adds the reconciliation layer so Halo can retry safely, compare redacted balance movement, and still refuse to mark a grant paid without relayer or webhook confirmation.

Q: Is balance movement enough to claim a grant was paid?
A: No. Balance movement can help debug a relay response, but Halo's public paid state still requires a returned TaskId/status or a signed webhook. This keeps the audit trail tied to the relayer workflow.

Q: What is the correct public status if Step 20 still has no TaskId and no movement?
A: `NO-GO` for payout confirmation. The right public wording is a debug note: the gate held, no paid claim was made, and the next action is relayer/status reconciliation.
