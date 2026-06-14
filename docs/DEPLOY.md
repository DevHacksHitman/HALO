Yes, Vercel deployment usually starts with GitHub, but **do not blindly commit all dirty files**.

The right sequence is:

1. **Review dirty files**

   ```bash
   git status --short
   git diff --stat
   ```

2. **Make sure secrets are not committed**
   Never commit:
   - `.env.local`
   - private keys
   - `VENICE_API_KEY`
   - `ONESHOT_API_KEY`
   - Upstash tokens
   - raw MetaMask permission context if you consider it sensitive

   Commit `.env.example`, not `.env.local`.

3. **Run verification**

   ```bash
   npm run test:backend
   npm run build
   forge test
   ```

4. **Stage intended files**
   Example:

   ```bash
   git add app components lib test docs scripts package.json package-lock.json .env.example
   ```

   If `.agents/`, `skills/`, or generated artifacts are user-owned or not needed for deployment, do not add them unless we explicitly decide they belong in the repo.

5. **Review staged files**

   ```bash
   git diff --cached --stat
   git diff --cached
   ```

6. **Commit**

   ```bash
   git commit -m "Prepare Halo final hackathon demo"
   ```

7. **Push to GitHub**

   ```bash
   git push origin main
   ```

8. **Deploy on Vercel**
   - Go to Vercel.
   - New Project.
   - Import the GitHub repo.
   - Framework should auto-detect: `Next.js`.
   - Build command: `npm run build`.
   - Output: leave default.
   - Add environment variables in Vercel dashboard.

Minimum Vercel env vars:

```bash
VENICE_API_KEY=...
VENICE_VISION_MODEL=google-gemma-3-27b-it

ONESHOT_API_KEY=...
ONESHOT_RELAYER_TARGET_WALLET_ADDRESS=...

NEXT_PUBLIC_HALO_CHAIN_PROFILE=base-sepolia
NEXT_PUBLIC_HALO_CHAIN_ID=84532
NEXT_PUBLIC_HALO_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_HALO_MONTHLY_CAP_USDC=100
NEXT_PUBLIC_ONESHOT_RELAYER_TARGET_WALLET_ADDRESS=...

UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
HALO_GRANT_STATUS_REDIS_KEY=halo:grant-status-events
```

If the Vercel Upstash integration creates locked variables such as
`KV_REST_API_URL`, `KV_REST_API_TOKEN`,
`UPSTASH_REDIS_REST_KV_REST_API_URL`, or
`UPSTASH_REDIS_REST_KV_REST_API_TOKEN`, Halo can read those as fallbacks.
The canonical `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
names are still preferred when you can add manual aliases.

After first deploy, set:

```bash
HALO_ONESHOT_WEBHOOK_URL=https://halofund.vercel.app/api/webhooks/1shot
```

Then redeploy.

Important: **Vercel will not use your local `.env.local`**. Every needed value must be added in Vercel Project Settings → Environment Variables.

So the answer is: **yes, GitHub first, but commit selectively and safely.** We should do a commit audit before staging anything.
