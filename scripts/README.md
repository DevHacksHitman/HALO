# Halo Demo Scripts

This directory is ordered around the public checkpoint sequence. Prefer the
`.sh` entrypoint for recordings because it prints the proof banner, loads
`.env.local`, runs the focused tests, and then calls the matching `.mjs` script.

## Current Relay Boundary

- `demo_step18_live_send_rehearsal.sh`: live estimate + send-gate rehearsal, no send.
- `demo_step19_relay_reconciliation.sh`: reconciliation dry-run. This forces `HALO_ONESHOT_LIVE=0`; it must not create a TaskId or paid claim.
- `demo_step20_relay_reconciliation.sh`: live send proof. This is the only Step 20 command that may create a TaskId when `HALO_ONESHOT_LIVE=1`.
- `demo_step20_status_repoll.sh`: status-only recovery for an already saved TaskId. It never estimates, sends, or resends.
- `demo_step21_venice_live_verifier.sh`: live Venice AI verifier proof using `VENICE_API_KEY` credits. It never settles x402 or calls 1Shot.
- `demo_step22_venice_x402_shadow_probe.sh`: live Venice x402 discovery proof. It captures the payment requirement in shadow mode and never sends `X-402-Payment`.
- `demo_step23_a2a_redelegation_proof.sh`: local A2A proof. It verifies two-hop Verifier/Treasurer redelegation and rejects direct delegation for A2A claims.
- `demo_step24_mainnet_preflight.sh`: Base mainnet preflight. It verifies production 1Shot profile, target, caps, 7702 readiness, and A2A compatibility, but forces live send off.

`demo_step19_relay_reconciliation.mjs` intentionally reuses the Step 20
reconciliation engine with Step 19/no-send flags so the dry-run and paid-proof
paths stay aligned.

## Future Mainnet Prep

- `demo_step25_mainnet_relay_confirmation.sh`: future guarded mainnet relay confirmation candidate.

Mainnet sends must stay blocked until the explicit arming flags, caps, webhook
URL, and final demo funding are ready.

## Historical Scripts

Older step scripts are kept when they are still part of the public build log or
are wrappers used by docs/package scripts. Remove scripts when a newer checkpoint
has replaced their behavior and the old name creates an unsafe or confusing
path.
