I’ll give you a **master prompt** you can feed to your AI assistant to generate a full, meticulous implementation plan – split into ART (frontend, platform design, UX) and SCIENCE (architecture, contracts, logic, code). I’ll then add a handful of enhancements that could push this project into “unbeatable” territory.

---

## The Master Prompt (Copy-Paste This Into Your Assistant)

```
You are a world-class hackathon architect and full-stack web3 engineer. I'm building a project called "Halo – The Programmable Mutual Aid Fund" for the MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook Off. Here's the core concept:

Halo allows a Donor to delegate a monthly allowance via ERC-7710/7715 to an AI agent. A Requester can request a micro-grant (e.g., $30 for baby formula) by uploading a photo of a receipt/need. The AI agent autonomously verifies the request using Venice Vision, pays the x402 invoice, generates an empathetic message via Venice Text, and routes the stablecoin payment through 1Shot relayer with gas abstraction. Redelegation is used between a Master Almoner and Verifier/Treasurer sub-agents.

Please produce a complete, detailed implementation plan covering both the "ART" (frontend design, platform design, UX architecture, component trees, user flows, demo script, visual identity) and the "SCIENCE" (smart contract architecture, delegation/redelegation logic, backend services, Venice/x402 integration, 1Shot relayer integration, webhook handling, database design, testing strategy, and deployment).

The plan must:
1. Be meticulously thorough, with file-by-file breakdowns of the frontend and contract structure.
2. Include a detailed architectural diagram description (ascii or mermaid.js).
3. Specify exact technologies: Next.js 15, wagmi, viem, MetaMask Smart Accounts Kit, 1Shot API endpoints, Venice AI SDK, x402 protocol, ERC-7710/7715/7702, TailwindCSS, shadcn/ui, Supabase/Prisma for off-chain data.
4. Outline the complete demo flow second-by-second, including terminal logs that will be shown.
5. Address every hackathon track judging criterion: how each requirement is satisfied.
6. Provide detailed logic for the Verifier Agent (how it uses Venice Vision, processes x402, prevents spam) and the Treasurer Agent (gasless payout via 1Shot, webhook updates).
7. Include a full ERC-7710 delegation and redelegation flow diagram with specific contract calls and parameters.
8. Propose a mobile-first, warm, inviting UI design language with specific component names and color palette suggestions.
9. Suggest a database schema for tracking donors, requests, grants, delegations, and transaction statuses.
10. Include a comprehensive testing plan and steps to deploy to a testnet (Sepolia or Base Sepolia) with verification.

Make the plan extremely actionable – a developer should be able to start coding immediately after reading it. Output everything in a well-structured markdown format.
```

---

## How to Break This Into Sub-Prompts (If You Need Deeper Dives)

After getting the overall plan, you can drill deeper with these follow-up prompts:

**For pure ART/UX:**

```
Design a detailed front-end architecture for Halo. The app has three user personas: Donor, Requester, and Public Viewer. Create a mobile-first design system with warm, soft colors and empathetic micro-interactions. Provide:

1. A complete route structure (Next.js App Router).
2. Reusable component tree with descriptions of each component's purpose.
3. A sitemap and user flow diagrams (text-based).
4. Low-fidelity wireframe descriptions for key screens: Donor Onboarding, Requester Chat, Community Dashboard.
5. CSS/Tailwind design tokens: color palette, typography, spacing, border-radius, shadow system.
6. Accessibility considerations (screen reader support, color contrast).
7. Animation and transition specs to convey warmth (like gentle fade-ins, heartbeat-like pulse on donation).
```

**For pure SCIENCE/Contracts:**

```
Design the complete smart contract system for Halo. Focus on:
1. The MasterAlmoner contract: ERC-7710 delegation management, redelegation to sub-agents, funding pool, grant limits.
2. The VerifierAgent contract: interface with Venice/x402, verify logic, spending limited to API fees.
3. The TreasurerAgent contract: payout logic, gas abstraction via 1Shot, ERC-7702 account upgrade support.
4. Exact bytecode interaction: show how a Donor signs an ERC-7715 Advanced Permission off-chain, how it's redeemed on-chain for a delegation, and how redelegation works with time-bound caveats.
5. Smart contract functions, modifiers, events, and error handling.
6. Security considerations: replay attacks, signature malleability, spam prevention using staking or reputation.
7. Use Solidity with hardhat/foundry, write tests for each delegation flow.

Provide the full interface definitions and core function implementations in pseudocode or Solidity snippets.
```

**For AI/Verification Logic:**

```
Detail the Verifier Agent's implementation. It must:
1. Accept an image and a text request.
2. Call Venice Vision API to analyze the image and extract key information (receipt items, prices, dates).
3. Cross-check the extracted info with the user's request text using Venice Text API with structured output (JSON).
4. If verification passes, calculate the exact payout amount (capped at the sub-agent's allowance).
5. Make the x402 payment autonomously using its delegated funds.
6. Generate an empathetic, personalized message using Venice Text with a specific tone (warm, encouraging, community-minded).
7. Provide a fallback handling if Venice is unreachable or image is unclear (ask for clarification).
8. Show how to handle concurrent requests using queues and nonce management.

Write this as an architectural specification with flowcharts in text and detailed pseudocode for the service.
```

---

## Extra Enhancement Ideas to Make Halo Irresistible

These are not required for prize eligibility but will make your project undeniably superior:

### 1. Zero-Knowledge Privacy Layer

**Problem:** Requesters might be embarrassed asking for help.  
**Solution:** Use zk proofs (e.g., using Risc Zero or SP1) to prove that a receipt is valid and the amount is below a cap _without revealing the receipt contents or requester identity_. The AI still sees the image for empathy but the on-chain record only shows a zk-verified grant. This marries privacy with transparency.

### 2. Reputation & Anti-Spam via EAS (Ethereum Attestation Service)

**Problem:** Bad actors could spam requests.  
**Solution:** After a grant, the Donor or the AI issues an on-chain attestation “This recipient was genuinely helped.” A Requester builds a trust score. The AI weighs attestation scores when verifying. Spam-resistant without gatekeeping.

### 3. “Pay it Forward” Loop

**Problem:** How to sustain the fund.  
**Solution:** When a recipient later becomes stable, the UI nudges them to become a Donor (with a small delegation). The dashboard shows a “circle of giving” – visualizing how past recipients now sponsor new ones. This creates a self-growing community.

### 4. Venice-Powered Grant Writing Helper

**Problem:** Users may struggle to articulate their need.  
**Solution:** Before submitting a request, the chat interface offers a “Help me write my request” button. It uses Venice Text (free, no x402 initially) to craft a dignified, clear description from a short prompt. This reduces shame and improves verification accuracy.

### 5. Live “Kindness Feed” with Minimal Info

**Problem:** The public dashboard could feel like a ledger.  
**Solution:** Show anonymous, real-time feed of grant completions using 1Shot webhooks. Each entry like: “A student received $25 for a textbook 📚 – Sent via Halo, 2 min ago.” Include the AI-generated encouraging snippet. Combine with soft animations; make it feel like a community fireplace.

### 6. Auto-Investment of Idle Pool via ERC-4626

**Problem:** Pooled funds sitting idle lose value to inflation.  
**Solution:** Donors can opt-in to have idle funds deposited into a low-risk yield source (e.g., sDAI or Aave) through the Master Almoner, and only withdrawals are capped by delegation limits. This makes the fund “evergreen.”

### 7. ERC-7715 Caveat: “Donor Remorse” Reversal

**Problem:** What if a Donor makes a mistake in delegation?  
**Solution:** Add a time-delayed revocation with a 24-hour cancel window. The delegation has a caveat that no grants can be executed in the first 24h, allowing the Donor to revoke before funds flow. This builds trust.

### 8. Gamified Giving with Soulbound Tokens

**Problem:** Donors need an incentive beyond altruism.  
**Solution:** Issue a non-transferable “Halo Angel” badge (ERC-5192 Soulbound Token) after they delegate. The badge upgrades based on cumulative giving (bronze, silver, gold). This encourages larger, sustained delegations and provides social proof.

---

## Summary of the Prompt Strategy

1. Use the **Master Prompt** to get a 360-degree plan.
2. Then drill into **ART** and **SCIENCE** sub-prompts for exhaustive detail.
3. Optionally incorporate the enhancements to create a project that’s not just a hackathon winner but a real-world viable protocol.

Give those to your AI assistant, and it will output a surgical, build-ready blueprint.

### ** CORE IDEA **

Here is a perfect pivot. We are going to take the exact same "document verification & fund release" architecture of RedTape, but flip the emotional valence from _fighting the system_ to _supporting the community_.

Instead of an Autonomous Bureaucracy Hacker, we build an **Autonomous Micro-Philanthropist**.

### Project Name: "Halo" (The Programmable Mutual Aid Fund)

**The Concept:** A decentralized community care fund. Users (Donors) delegate a monthly allowance to an AI. Anyone in the community can request an immediate micro-grant (e.g., "$30 for baby formula," "$50 for a textbook," "$15 for a prescription") by uploading a photo of their receipt or need. Halo autonomously verifies the request with empathy, writes an encouraging note, and instantly routes the funds.

**The Human Story:** GoFundMe is too heavy for a $20 emergency, and manual mutual aid funds exhaust their human volunteers with administrative burnout and emotional fatigue. Halo removes the friction and the shame of asking, providing instant, private, dignity-preserving relief.

### The Meticulous Track Alignment (The "Warm" Execution)

**1. 1Shot API (Gas Abstraction & Onboarding)**

- **The Warmth:** People needing emergency $20 grants don't have ETH for gas, and Donors want a frictionless experience.
- **The Tech:** A Donor connects their standard EOA. You use **EIP-7702** to silently upgrade them to a Smart Account. The **1Shot Permissionless Relayer** handles all backend transactions, paying gas in stablecoins (USDC).

**2. MetaMask (7710 Advanced Permissions)**

- **The Action:** The Donor clicks "Sponsor the Fund." They sign a single **ERC-7715 Advanced Permission** granting the "Halo Master Almoner" contract a maximum spend of $100 per month, with a strict caveat that no single grant can exceed $30.

**3. A2A Coordination (Redelegation)**

- **The Action:** A student submits a photo of a textbook syllabus and requests $25. The Halo Master Agent recognizes it needs to process a claim.
- **The Tech:** It **redelegates** authority to two highly specialized sub-agents:
  - _The Verifier Sub-Agent:_ Granted $2 to spend on API inference.
  - _The Treasurer Sub-Agent:_ Granted the exact $25 requested to execute the payout.

**4. Venice AI (x402 & Multimodal)**

- **The Tech:**
  - The Verifier Sub-Agent hits the **Venice Vision API**, intercepting and paying the **x402 invoice** autonomously using its redelegated $2. It scans the syllabus photo to ensure it matches the request (preventing spam).
  - Once verified, it hits the **Venice Text API** (paying another x402) to generate a deeply personalized, warm, and encouraging message based on the syllabus (_"Good luck in your organic chemistry class! The community believes in you."_).
- **The Hook:** This scores maximum points for Venice by combining Vision, Text, and agentic x402 payments.

**5. 1Shot API (Execution & Webhooks)**

- **The Action:** The Treasurer Sub-Agent uses the 1Shot relayer to gaslessly send the $25 USDC directly to the student's wallet alongside the encouraging message.
- **The Tech:** You use **1Shot Webhooks** to update the public "Halo Community Dashboard," showing a real-time feed of anonymous, verified acts of kindness.

### The Demo Strategy (How to make the judges feel something)

1.  **Start with the Donor:** Show the sleek, inviting UI. The Donor upgrades their account (7702 logs show in terminal) and delegates $100 to the Halo pool (7710).
2.  **Switch to the Requester:** Use a split-screen. The UI is a simple, mobile-friendly chat interface (like WhatsApp). The user types: _"I am short on cash for my asthma inhaler this week,"_ and uploads a photo of the pharmacy receipt.
3.  **The Terminal Magic:** In the terminal on the right, the judges see the A2A redelegation fire. They see the exact moment the Verifier Agent hits the `402 Payment Required` from Venice, pays it autonomously, and processes the image.
4.  **The Payoff:** In the chat UI, the user receives an instant reply from Halo: _"We've got you covered. Breathe easy. Sent $15 USDC."_ The 1Shot webhook updates the transaction as "Success."

### Why this is a Masterstroke:

- It is completely organic. It proves that AI and Crypto can be used to **scale human empathy and trust**, rather than just scaling financial trading.
- It mathematically fulfills every single strict, technical requirement of the hackathon (7702, 7710, Redelegation, x402, Venice, 1Shot).
- It is visually striking: A sterile, complex crypto backend wrapped in a beautiful, heartwarming consumer front-end.

No one else will build this. They will all be building "DeFi Yield Optimizers." You will be building a fully autonomous, hyper-efficient digital charity.
