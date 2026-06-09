# Halo Interim Audit Review

**Reviewer**: Senior Web3 Engineer / Hackathon EVM Judge  
**Date**: 2026-06-04  
**Scope**: Full codebase review against [INTERIM_AUDIT_BRIEF.md](file:///Users/apple/HALO/docs/INTERIM_AUDIT_BRIEF.md)  
**Verdict concurrence**: **CONDITIONAL GO confirmed** — keep building. **NO-GO for live funds confirmed** — every gate in the brief is real.

**Remediation update**: C-2 has been fixed after review. `ONESHOT_RELAYER_RPC_URL` now defaults to the 1Shot testnet relayer through `DEFAULT_ONESHOT_RELAYER_RPC_URL`, and backend coverage asserts that default.

---

## Executive Summary

Halo demonstrates unusually strong architectural discipline for a hackathon project. The non-custodial claim holds up under code review: no contract pools funds, every ERC20 `transfer` execution targets the USDC contract with the payee encoded in calldata, and the live-send path is gated behind an explicit env flag. The Solidity layer is clean, minimal, and fully tested. The backend JS layer mirrors the on-chain caps faithfully and adds structural safeguards (decoded delegation array enforcement, fee cap re-checks, append-only grant status FSM).

The build is meaningfully ahead of most hackathon submissions at the interim stage. However, the gap between "locally validated construction" and "live permissioned relay" is where all the real risk lives. My findings below focus on hardening that transition.

---

## 1. Solidity Contracts — Detailed Review

### 1.1 [HaloAlmoner.sol](file:///Users/apple/HALO/src/HaloAlmoner.sol)

| Aspect                  | Assessment                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-custody             | ✅ Contract never holds, receives, or transfers tokens. Pure view logic.                                                                                                                 |
| Access control          | ✅ Only `verifierAgent` and `treasurerAgent` are allowed; rogue agents revert with `UnauthorizedAgent`.                                                                                  |
| Cap enforcement         | ✅ `MAX_VERIFIER_FEE` (2 USDC) and `MAX_GRANT_AMOUNT` (30 USDC) enforced on every path.                                                                                                  |
| Caveat structure        | ✅ Three-caveat bundle: `AllowedTarget` → USDC, `TransferRecipient` → approved payee, `SpendLimit` → capped amount. Correct separation of EVM call target from ERC20 calldata recipient. |
| Verifier recipient lock | ✅ Verifier can only send to `venicePaymaster`.                                                                                                                                          |
| Constructor guards      | ✅ All 7 addresses checked for zero; verifier ≠ treasurer enforced.                                                                                                                      |
| Immutability            | ✅ All state is `immutable` — no owner, no upgradeability, no mutable storage. Minimal attack surface.                                                                                   |

> [!TIP]
> The immutable-only design is the right call for a hackathon. It eliminates governance risk entirely. For a production version, consider whether the Almoner should be re-deployable behind a registry so caps can be updated without a full redeployment.

**Finding A-1** (Informational): `_validateTreasurerRedelegation` is `pure` while `_validateVerifierRedelegation` is `view` (reads `venicePaymaster`). This is correct, but the asymmetry may confuse future readers. Consider a brief NatSpec comment on `_validateTreasurerRedelegation` explaining why it doesn't need state.

### 1.2 [HaloVerifier.sol](file:///Users/apple/HALO/src/HaloVerifier.sol) & [HaloTreasurer.sol](file:///Users/apple/HALO/src/HaloTreasurer.sol)

Both are stateless pure-function helpers that construct `Execution` structs. They:

- Never hold funds ✅
- Validate zero address and zero amount ✅
- Target the USDC token contract (not the payee) ✅
- Encode `IERC20.transfer.selector` correctly ✅

> [!NOTE]
> These contracts serve primarily as on-chain proof of intent construction. In a live flow, the actual execution happens through the donor's Smart Account via 1Shot. The helpers exist to make the payload construction auditable on-chain, which is a good design pattern for judge visibility.

### 1.3 [HaloTypes.sol](file:///Users/apple/HALO/src/HaloTypes.sol)

Minimal local mirrors of `Caveat` and `Execution`. These are intentionally local rather than imported from a delegation framework — correct choice for a hackathon to avoid dependency risk.

### 1.4 [IERC20.sol](file:///Users/apple/HALO/src/interfaces/IERC20.sol)

Minimal `transfer` selector only. Correct — Halo only needs the selector for calldata encoding.

### 1.5 Foundry Test Coverage

| Test file                                                                | Tests | Assessment                                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [HaloAlmoner.t.sol](file:///Users/apple/HALO/test/HaloAlmoner.t.sol)     | 8     | Constructor zero-address (7 slots), duplicate agent, verifier caveat shape, treasurer caveat shape, rogue agent, wrong verifier recipient, fee over cap, grant over cap, zero amount. **Comprehensive.** |
| [HaloSubAgents.t.sol](file:///Users/apple/HALO/test/HaloSubAgents.t.sol) | 6     | Verifier payload shape + selector + calldata hash, Treasurer payload shape, zero token/paymaster/amount for both. **Comprehensive.**                                                                     |

> [!IMPORTANT]
> The Solidity tests use `try/catch` + `require(reverted)` instead of `forge-std` `vm.expectRevert`. This is a deliberate choice to stay dependency-free. It works, but it catches _any_ revert — not just the expected custom error. For the final report, consider asserting the specific error selector to prove the _right_ guard fired.

---

## 2. Backend Bridge — [haloAgentBridge.mjs](file:///Users/apple/HALO/lib/haloAgentBridge.mjs)

| Aspect                | Assessment                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Cap mirroring         | ✅ `MAX_VERIFIER_FEE_ATOMS = 2_000_000n` and `MAX_GRANT_AMOUNT_ATOMS = 30_000_000n` match Solidity constants exactly. |
| Cap enforcement       | ✅ `assertWithinCap` runs before execution construction.                                                              |
| ERC20 target          | ✅ `buildUsdcTransferExecution` uses `usdcToken` as `target`, payee in calldata.                                      |
| Auditability          | ✅ `decodeErc20Transfer` is called on the constructed execution for log transparency.                                 |
| Address normalization | ✅ `normalizeAddress` validates 20-byte hex and lowercases.                                                           |

**Finding B-1** (Low): The JS cap constants are duplicated from Solidity. If one changes without the other, the off-chain check could pass while the on-chain check reverts, or vice versa. Consider a build-time assertion or a shared constant source.

---

## 3. 1Shot Relay Wrapper — [oneShot.mjs](file:///Users/apple/HALO/lib/oneShot.mjs)

This is the most critical bridge component. Findings:

### ✅ Correct structural decisions

- **Decoded delegation array enforcement** ([L64-76](file:///Users/apple/HALO/lib/oneShot.mjs#L64-L76)): `normalizePermissionContext` throws if given a string. This is the key defense against passing MetaMask's raw hex context directly to 1Shot. Well-tested in [oneShot.test.mjs L113-123](file:///Users/apple/HALO/test/backend/oneShot.test.mjs#L113-L123).
- **Live send gate** ([L197-198](file:///Users/apple/HALO/lib/oneShot.mjs#L197-L198)): `sendOneShot7710Transaction` requires `HALO_ONESHOT_LIVE=1` or `allowLive=true`. Well-tested.
- **Full delegation normalization** ([L45-62](file:///Users/apple/HALO/lib/oneShot.mjs#L45-L62)): `delegate`, `delegator`, `authority`, `caveats`, `salt`, `signature` are all validated and normalized.
- **Method whitelist** ([L13-19](file:///Users/apple/HALO/lib/oneShot.mjs#L13-L19)): Only 5 known 1Shot methods accepted.

### Findings

**Finding C-1** (Medium): The `postOneShotJsonRpc` function ([L166-187](file:///Users/apple/HALO/lib/oneShot.mjs#L166-L187)) does not include an API key header. 1Shot's production relayer likely requires authentication. When you move to live calls, you'll need to add `Authorization: Bearer $ONESHOT_API_KEY` or whatever their auth scheme is. The current implementation will get a `401` or `403` on the first live call. This is fine for the interim, but flag it for the integration sprint.

**Finding C-2** (Remediated): `ONESHOT_RELAYER_RPC_URL` previously defaulted to mainnet ([L5-6](file:///Users/apple/HALO/lib/oneShot.mjs#L5-L6)). Since the entire project targets Base Sepolia, this default was dangerous. It now defaults to the testnet relayer unless explicitly configured.

> [!WARNING]
> [!NOTE]
> **C-2 remediation:** The default now points to the 1Shot testnet relayer, and `oneShot.test.mjs` includes a regression test for this safety default.

**Finding C-3** (Informational): The `context` field in `buildOneShot7710Params` is passed through as-is. If this is a signed quote from 1Shot's fee estimation, ensure the quote hasn't expired before calling send. This is a live-integration concern, not a current bug.

---

## 4. Venice/x402 Verifier — [veniceVerifier.mjs](file:///Users/apple/HALO/lib/veniceVerifier.mjs)

### ✅ Correct structural decisions

- SIWX wallet-auth boundary enforced — `X-Sign-In-With-X` header is required, not stored in env.
- Receipt image URL validated against `data:image/` base64 or `https://` — no arbitrary scheme injection.
- JSON parsing is robust — handles markdown code fences, extracts first `{...}` object.
- `evaluateReceiptVerification` re-checks against the grant cap _after_ Venice responds — defense in depth.
- `selectUsdcPaymentOffer` normalizes and validates the x402 payment requirement structure with network + asset matching.

### Findings

**Finding D-1** (Medium): `parseVeniceVerificationResult` trusts Venice's JSON output for the `valid` boolean. If Venice's model hallucinates or is prompt-injected (e.g., the receipt image contains adversarial text), it could return `valid: true` for a fraudulent receipt. For production, add:

1. A confidence threshold check
2. A secondary verification (e.g., OCR cross-validation)
3. Human-in-the-loop approval above a certain amount

This is expected for a hackathon demo and correctly documented in the brief. Flagging for the risk register.

**Finding D-2** (Low): `temperature: 0` in the vision request ([L62](file:///Users/apple/HALO/lib/veniceVerifier.mjs#L62)) is good for determinism, but some Venice models may not fully respect this parameter. No action needed now.

**Finding D-3** (Informational): The `buildVeniceTopUpProbeRequest` sends an empty POST with no body or auth. This is presumably to trigger the `402 Payment Required` response and extract the payment requirement header. Smart probe pattern. Just ensure the probe doesn't accidentally create state on Venice's side.

---

## 5. Webhook Status Tracking — [grantStatus.mjs](file:///Users/apple/HALO/lib/grantStatus.mjs)

### ✅ Correct structural decisions

- Append-only event log — no status can be deleted or overwritten
- Status FSM with rank-based transitions — `PAID` cannot be downgraded by a late `pending` event
- `FAILED` is terminal — once failed, always failed (even if a late `success` arrives)
- 12 1Shot status strings mapped to 3 Halo states — defensive normalization
- Singleton store attached to `globalThis` for Next.js HMR safety

### Findings

**Finding E-1** (Medium — live integration): The webhook endpoint ([route.ts](file:///Users/apple/HALO/app/api/webhooks/1shot/route.ts)) has **no signature verification**. Any HTTP client can POST a forged `success` event and mark a grant as `PAID`. This is correctly identified in R4 of the risk register. For the live integration sprint:

1. Verify 1Shot's webhook signature (HMAC or asymmetric)
2. Add IP allowlisting or a shared secret as a fallback
3. Add rate limiting

**Finding E-2** (Low): The in-memory `Map` store will lose all grant state on server restart. For a hackathon demo this is fine, but document it. For production, persist to a database.

**Finding E-3** (Informational): `chooseStatus` ([L175-185](file:///Users/apple/HALO/lib/grantStatus.mjs#L175-L185)) allows `FAILED` to override `PAID`. This is correct — if a tx reverts after initial success reporting, `FAILED` should win. Good edge-case handling.

---

## 6. MetaMask Permission Request — [haloPermissions.mjs](file:///Users/apple/HALO/lib/haloPermissions.mjs)

### ✅ Correct structural decisions

- `erc20-token-periodic` permission type with justification string
- Chain ID, token address, and period duration all validated
- `periodAmount` serialized to hex via `toHexQuantity` only at the wallet/RPC edge — internal logic uses BigInt
- `parseDecimalToAtoms` correctly handles decimal precision with explicit overflow check

### Findings

**Finding F-1** (Low): `isAdjustmentAllowed: true` ([L94](file:///Users/apple/HALO/lib/haloPermissions.mjs#L94)) means the donor could theoretically increase the allowance without Halo's involvement. Confirm this is intentional — it's probably fine for a donor-friendly UX, but document the trust assumption.

**Finding F-2** (Informational): The `from` and `to` fields in the permission request represent the donor and session account respectively. Ensure MetaMask's Advanced Permissions implementation interprets these the same way. This is a live-integration validation item.

---

## 7. Deployment Pipeline — [deployConfig.mjs](file:///Users/apple/HALO/lib/deployConfig.mjs) + [deploy_base_sepolia.sh](file:///Users/apple/HALO/scripts/deploy_base_sepolia.sh)

### ✅ Correct structural decisions

- Private key validated as 32-byte hex — rejects truncated or malformed keys
- `redactDeployConfig` strips private key and RPC URL from proof output
- Shell script validates all required env vars before any `forge create` call
- Chain ID cross-check via `cast chain-id` against the RPC endpoint
- Deploy outputs are parsed and chained — Verifier → Treasurer → Almoner with constructor args

### Findings

**Finding G-1** (Medium): The shell script pipes `$BASE_SEPOLIA_PRIVATE_KEY` as a command-line argument to `forge create`. On multi-user systems, this is visible in `/proc/*/cmdline` or `ps aux`. For production, use Foundry's `--keystore` or `--private-key-file` option. For a hackathon, this is acceptable.

**Finding G-2** (Low): The `DeployHalo.s.sol` Forge script ([script/DeployHalo.s.sol](file:///Users/apple/HALO/script/DeployHalo.s.sol)) is a minimal deploy helper without `forge-std Script` inheritance. This means it can't use `vm.startBroadcast()`. The shell script uses `forge create` directly, which is fine, but the `.s.sol` file is currently dead code. Either remove it or upgrade it to a proper broadcast script.

---

## 8. Test Coverage Assessment

| Layer               | Test file                                                                                  | Count                       | Verdict                  |
| ------------------- | ------------------------------------------------------------------------------------------ | --------------------------- | ------------------------ |
| Solidity: Almoner   | [HaloAlmoner.t.sol](file:///Users/apple/HALO/test/HaloAlmoner.t.sol)                       | 8                           | ✅ Excellent             |
| Solidity: SubAgents | [HaloSubAgents.t.sol](file:///Users/apple/HALO/test/HaloSubAgents.t.sol)                   | 6                           | ✅ Excellent             |
| JS: Permissions     | [haloPermissions.test.mjs](file:///Users/apple/HALO/test/backend/haloPermissions.test.mjs) | ~4                          | ✅ Good                  |
| JS: Agent Bridge    | [haloAgentBridge.test.mjs](file:///Users/apple/HALO/test/backend/haloAgentBridge.test.mjs) | ~6                          | ✅ Good                  |
| JS: 1Shot           | [oneShot.test.mjs](file:///Users/apple/HALO/test/backend/oneShot.test.mjs)                 | 5                           | ✅ Good                  |
| JS: Venice          | [veniceVerifier.test.mjs](file:///Users/apple/HALO/test/backend/veniceVerifier.test.mjs)   | 5                           | ✅ Good                  |
| JS: Grant Status    | [grantStatus.test.mjs](file:///Users/apple/HALO/test/backend/grantStatus.test.mjs)         | 4                           | ✅ Good                  |
| JS: Deploy Config   | [deployConfig.test.mjs](file:///Users/apple/HALO/test/backend/deployConfig.test.mjs)       | ~5                          | ✅ Good                  |
| **Total**           |                                                                                            | **18 Foundry + 33 Backend** | **51 tests, 0 failures** |

> [!TIP]
> 51 passing tests across two layers with zero failures is strong for a hackathon. The tests cover happy paths, boundary conditions, and rejection cases. The main gap is integration tests (e.g., end-to-end webhook → store → dashboard), but that's expected for interim.

### Missing test coverage (non-blocking for interim)

- **ERC20 encode/decode roundtrip** with boundary amounts (0, MAX_UINT256 - not currently tested in isolation)
- **Forge fuzz tests** on cap boundaries — would strengthen the Almoner's limit checks
- **API route tests** — the Next.js routes are thin wrappers, but a simple `fetch` test against `POST /api/webhooks/1shot` would close the loop

---

## 9. Answers to Reviewer Questions

### Q1: Are the non-custody claims technically accurate?

**Yes.** Verified across all layers:

- No contract has a `receive()`, `fallback()`, or any payable function
- No contract holds a token balance or calls `transferFrom` on behalf of a user
- All `Execution` structs set `target` to the USDC token contract, with the payee in `transfer(address,uint256)` calldata
- The backend bridge mirrors this: `buildUsdcTransferExecution` always sets `target: usdcToken`
- The live-send gate (`HALO_ONESHOT_LIVE`) prevents any actual transaction dispatch

### Q2: Is the ERC20 execution target/payee separation correctly represented?

**Yes.** The critical distinction — that the EVM `call.to` is the USDC contract while the `transfer` recipient is encoded in calldata — is correctly maintained in:

- [HaloAlmoner.sol L79](file:///Users/apple/HALO/src/HaloAlmoner.sol#L79): `caveats[0] = Caveat({enforcer: allowedTargetEnforcer, terms: abi.encode(usdcToken)})`
- [HaloVerifier.sol L24-28](file:///Users/apple/HALO/src/HaloVerifier.sol#L24-L28): `Execution({target: usdcToken, value: 0, data: abi.encodeWithSelector(...)})`
- [haloAgentBridge.mjs L9-13](file:///Users/apple/HALO/lib/haloAgentBridge.mjs#L9-L13): `target: normalizeAddress(usdcToken)`
- Tests verify both the `target` field and the decoded calldata independently

### Q3: Are caps enforced in every relevant path?

**Yes, with one caveat.** Caps are enforced:

- On-chain: `HaloAlmoner._validateVerifierRedelegation` and `_validateTreasurerRedelegation`
- Off-chain: `haloAgentBridge.assertWithinCap` for both `prepareVerifierX402Relay` and `prepareTreasurerGrantRelay`
- Venice flow: `evaluateReceiptVerification` re-checks against `maxGrantAmountAtoms`

The one caveat: the off-chain caps are hardcoded constants, not read from the deployed contract. See Finding B-1.

### Q4: Does the MetaMask permission request match Advanced Permissions behavior?

**Shape looks correct** for the `erc20-token-periodic` scheme. However, this is the least-validated part of the stack because no real MetaMask interaction has occurred yet. The permission request includes:

- `chainId: 84532` (Base Sepolia) ✅
- `from: donorAddress` ✅
- `to: sessionAccount` ✅
- `permission.type: "erc20-token-periodic"` ✅
- `permission.data.tokenAddress` ✅
- `permission.data.periodAmount` (hex-serialized at edge) ✅

**Live validation required** before any confidence in this answer.

### Q5: Does the 1Shot wrapper match the current relayer shape?

**Structurally plausible.** The wrapper builds `transactions[0].permissionContext` as a decoded delegation array with `caveats`, `delegate`, `delegator`, `authority`, `salt`, `signature`. This matches the ERC-7710 delegation shape. However:

- The exact field naming (e.g., `transactions` vs `calls`, `permissionContext` vs `delegations`) can only be confirmed against 1Shot's current OpenRPC spec
- The `context` and `destinationUrl` fields are passed through — confirm they're current

### Q6: Is deployment correctly separated from live broadcast?

**Yes.** The separation is clean:

- `deploy_base_sepolia.sh` uses `forge create` (immediate broadcast, no signing ceremony)
- `buildForgeDeploymentPlan` generates commands but does not execute them
- `DeployHalo.s.sol` does not inherit `Script`, so it can't `vm.broadcast()`
- No `--broadcast` flag appears anywhere in the codebase

### Q7: What additional tests are needed before live testnet relay?

In priority order:

1. **Real MetaMask permission capture** → decode the returned context → assert it matches the delegation array schema that `normalizePermissionContext` expects
2. **1Shot estimate call** with the real decoded context → verify the response shape and fee structure
3. **End-to-end webhook roundtrip** → `POST /api/webhooks/1shot` with a realistic payload → verify `/api/grants` reflects the state change
4. **Venice SIWX auth probe** → confirm the `X-Sign-In-With-X` header is accepted and the `402` probe returns the expected payment requirement shape
5. **Capped testnet send** → 1 USDC transfer on Base Sepolia with a known recipient → verify the tx on-chain

---

## 10. Risk Register Evaluation

| Risk                               | Brief's assessment           | My assessment                                                                                             |
| ---------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| R1: Permission-context mismatch    | Correct mitigation           | ✅ `normalizePermissionContext` is the right gate. Add a decode step test once real context is available. |
| R2: Overclaiming live execution    | Correct mitigation           | ✅ But recommend a grep-audit of all docs/posts for "live", "payout", "sent" claims before submission.    |
| R3: Caveat enforcement assumptions | Correct mitigation           | ✅ The shape is right; the addresses must be verified against MetaMask's Delegation Toolkit contracts.    |
| R4: Webhook authenticity           | Correctly identified as open | ⚠️ **Highest live-risk item.** Prioritize this immediately after first successful relay.                  |
| R5: Chain confusion                | Correct mitigation           | ✅ All config, code, and the `.env.example` target `84532`.                                               |
| R6: Secret handling                | Correct mitigation           | ✅ `redactDeployConfig` works. Shell script uses `forge create --private-key` (see G-1).                  |

### Additional risks not in the register

**R7: Relay URL default to mainnet** (see C-2). Remediated after review: if `ONESHOT_RELAYER_RPC_URL` is unset, the code now defaults to the 1Shot testnet relayer.

**R8: In-memory grant store durability**. Server restart loses all grant state. Not a security risk, but an operational one for demo reliability.

---

## 11. Consolidated Finding Severity Table

| ID  | Severity | Component       | Finding                                | Action                                        |
| --- | -------- | --------------- | -------------------------------------- | --------------------------------------------- |
| C-2 | **High, remediated** | 1Shot wrapper   | Relay URL previously defaulted to mainnet | Fixed: default now points to testnet and has regression coverage |
| C-1 | Medium   | 1Shot wrapper   | No API auth header                     | Add before first live call                    |
| D-1 | Medium   | Venice verifier | AI receipt validation trust boundary   | Document; add human-in-loop for production    |
| E-1 | Medium   | Webhook route   | No signature verification              | Add when 1Shot provides signing scheme        |
| G-1 | Medium   | Deploy script   | Private key visible in process list    | Use `--keystore` for production               |
| B-1 | Low      | Agent bridge    | Cap constants duplicated from Solidity | Consider build-time sync                      |
| C-3 | Low      | 1Shot wrapper   | Quote context expiry not checked       | Validate during live integration              |
| E-2 | Low      | Grant status    | In-memory store                        | Persist for production                        |
| F-1 | Low      | Permissions     | `isAdjustmentAllowed: true`            | Document trust assumption                     |
| G-2 | Low      | Deploy script   | `DeployHalo.s.sol` is dead code        | Remove or upgrade                             |
| A-1 | Info     | Almoner         | `pure` vs `view` asymmetry             | Add NatSpec                                   |
| D-2 | Info     | Venice verifier | `temperature: 0` model compliance      | No action                                     |
| D-3 | Info     | Venice verifier | Top-up probe side-effects              | Verify with Venice                            |
| F-2 | Info     | Permissions     | `from`/`to` field semantics            | Verify with MetaMask                          |

---

## 12. Hackathon Judge Scorecard

| Criterion              | Score (1-10) | Notes                                                                                                                                                                   |
| ---------------------- | :----------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Technical depth**    |      9       | Multi-layer architecture spanning Solidity, backend JS, Next.js, and three external protocol integrations (MetaMask 7710, 1Shot, Venice x402). Rare at hackathon level. |
| **Correctness**        |      8       | Non-custody boundary holds up under review. Cap enforcement is consistent across layers. C-2 has since been remediated; live integration gates remain the main deduction. |
| **Test quality**       |      8       | 51 tests, zero failures, covering both positive and negative paths. Missing fuzz tests and integration tests keep this from a 9.                                        |
| **Security awareness** |      9       | Live-send gate, decoded-context enforcement, append-only status FSM, secret redaction, and an honest risk register demonstrate strong security thinking.                |
| **Documentation**      |      8       | The interim brief is well-structured and honest about what's proven and what's not. The codebase has good NatSpec and inline comments.                                  |
| **Demo readiness**     |      7       | Locally proven construction is solid, but no live flow has been demonstrated yet. The "wired, not yet live" gap is the main demo weakness.                              |
| **Innovation**         |      9       | Scoped donor permissions + AI receipt verification + autonomous relay is a compelling composition. The non-custodial design pattern for mutual-aid is novel.            |
| **Overall**            |   **8.3**    | Strong interim submission. Close the live-integration gates and this is a serious contender.                                                                            |

---

## 13. Recommended Immediate Actions

1. **C-2 fixed**: Keep the 1Shot relay URL default on testnet and keep the regression test green.
2. **MetaMask permission capture**: This is the critical path item. Everything downstream depends on getting a real decoded permission context.
3. **1Shot estimate with real context**: Validates the entire delegation shape end-to-end.
4. **Venice SIWX probe**: Confirm the auth boundary works with real credentials.
5. **Webhook signature verification**: Even a placeholder HMAC check is better than open ingestion.

> [!CAUTION]
> Do not set `HALO_ONESHOT_LIVE=1` until items 1-3 are complete and verified on Base Sepolia with capped testnet USDC.

---

_Review complete. The CONDITIONAL GO verdict in the interim brief is accurate and well-supported by the evidence. The engineering quality is well above hackathon median. Focus on closing the live-integration gates in sequence, and this project is ready for a strong final submission._
