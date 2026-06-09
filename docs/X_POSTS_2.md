CONDITIONAL GO. Step 18 is wired as a live-send rehearsal gate, not an automatic payout.

Implemented:

- [oneShotLiveSendRehearsal.mjs](/Users/apple/HALO/lib/oneShotLiveSendRehearsal.mjs)
- [demo_step18_live_send_rehearsal.sh](/Users/apple/HALO/scripts/demo_step18_live_send_rehearsal.sh)
- [demo_step18_live_send_rehearsal.mjs](/Users/apple/HALO/scripts/demo_step18_live_send_rehearsal.mjs)
- Step 18 docs/checkpoint in [X_POSTS.md](/Users/apple/HALO/docs/X_POSTS.md)
- Step 18 Mentor notes in [MENTOR_CHECKPOINTS.md](/Users/apple/HALO/docs/MENTOR_CHECKPOINTS.md)
- Safer default fee in `.env.example`: `HALO_ONESHOT_ESTIMATE_MOCK_FEE_USDC=0.01`

Verified:

- Step 18 focused tests: `23 passed`
- Backend tests: `81 passed`
- `npm run build`: passed
- `forge test`: `18 passed`
- Real Step 18 rehearsal with live estimate on, live send off: estimate `success=true`, fee matched `10000` atoms, send request built, no network send attempted.

Use this for the public Step 18 recording:

```bash
HALO_ONESHOT_ESTIMATE_MOCK_FEE_USDC=0.01 HALO_ONESHOT_ESTIMATE_LIVE=1 HALO_ONESHOT_LIVE=0 scripts/demo_step18_live_send_rehearsal.sh
```

Live send remains NO-GO unless you explicitly decide to run the same script with `HALO_ONESHOT_LIVE=1`.
