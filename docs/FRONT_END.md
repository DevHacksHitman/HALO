Here is the complete, meticulous Front-End Architecture for **Halo**.

This plan translates the complex Web3 backend (EIP-7702, ERC-7710, 1Shot, x402) into a frictionless, human-centric interface. We are building a Web3 app that feels like a premium, warm Web2 consumer product.

---

### 1. CSS/Tailwind Design Tokens (The "Warmth" System)

Add these extensions to your `tailwind.config.ts`. We avoid harsh blacks, pure whites, and sharp corners.

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        halo: {
          bg: "#FAF9F6", // Soft Ivory - warm, paper-like background
          text: "#2B2B2B", // Charcoal - softer contrast than pure black
          primary: {
            DEFAULT: "#4A5D23", // Deep Sage Green - grounding, growth, safety
            hover: "#3B4A1C",
            light: "#E8EDDF", // Soft mint for chat bubbles
          },
          accent: {
            DEFAULT: "#E07A5F", // Warm Coral - for alerts, heartbeats, emphasis
            light: "#F4C2C2",
          },
          surface: "#FFFFFF", // Card backgrounds
          border: "#E5E5E5", // Subtle dividers
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"], // UI legibility
        serif: ["var(--font-playfair)", "serif"], // Empathetic, human headers
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem", // Highly rounded corners (mobile-app feel)
      },
      boxShadow: {
        soft: "0 10px 40px -10px rgba(0,0,0,0.05)", // Diffuse, ethereal shadows
        float: "0 20px 40px -20px rgba(74,93,35,0.15)", // Green-tinted shadow for active elements
      },
    },
  },
};
export default config;
```

---

### 2. Route Structure (Next.js 15 App Router)

Keep the routing perfectly flat to minimize friction.

```text
app/
├── layout.tsx                  # Global providers (Wagmi, QueryClient, Framer Motion)
├── page.tsx                    # Landing Page & Public Viewer Dashboard
├── sponsor/
│   └── page.tsx                # Donor Persona: Dashboard & 7710 Delegation Flow
└── ask/
    └── page.tsx                # Requester Persona: Chat Interface & Image Upload
```

---

### 3. Reusable Component Tree

```text
components/
├── ui/                         # shadcn/ui base (customized with Halo design tokens)
│   ├── button.tsx              # Pill-shaped, rounded-full
│   ├── sheet.tsx               # Bottom-sliding drawer for mobile (crucial for Web3 txs)
│   └── toast.tsx               # Minimalist, non-intrusive notifications
├── layout/
│   ├── TopNav.tsx              # Logo (Left) and minimal Wallet Connect / ENS (Right)
│   └── BottomTabNav.tsx        # Mobile-only fixed bottom nav (Home | Sponsor | Ask)
├── shared/
│   ├── ConnectWalletDrawer.tsx # Mobile-friendly EOA connection
│   └── TerminalDebugger.tsx    # *HACKATHON CRITICAL*: The split-screen dev logs
├── features/
│   ├── donor/
│   │   ├── SponsorCard.tsx     # Apple Pay-style UI for signing the $100/mo allowance
│   │   ├── ImpactGraph.tsx     # Visualizing how their allowance is being spent
│   │   └── UpgradeToSmart.tsx  # The EIP-7702 1Shot relayer execution button
│   ├── requester/
│   │   ├── ChatInterface.tsx   # The main iMessage-style wrapper
│   │   ├── ChatBubble.tsx      # Renders AI text and status updates
│   │   └── ReceiptUploader.tsx # Camera integration for Venice Vision API
│   └── public/
│       └── LiveAidMarquee.tsx  # Infinite scrolling feed of 1Shot Webhook success events
```

---

### 4. Sitemap & User Flows

**A. Donor Flow (The Frictionless Web3 Onboarding)**

1. Lands on `/` -> Clicks "Sponsor the Fund" -> Routes to `/sponsor`.
2. Triggers `ConnectWalletDrawer`. User connects standard MetaMask (EOA).
3. UI presents a clean "Upgrade to Halo Smart Account" card. (Backend: Prepares **EIP-7702** payload via 1Shot).
4. User clicks "Authorize $100/mo". Bottom sheet slides up asking for a single signature. (Backend: Signs **ERC-7710/7715** delegation to Master Almoner).
5. Success Animation. Screen updates to show "You are protecting the community."

**B. Requester Flow (The Empathetic Aid Process)**

1. Lands on `/` -> Clicks "I Need Help" -> Routes to `/ask`.
2. Clean chat interface. Bot message: _"Hi. What do you need help with today?"_
3. User types: _"I need baby formula"_ and clicks the Camera icon (`ReceiptUploader`) to snap a pic of the empty formula can/price tag.
4. Bot shows `<TypingIndicator />` (Backend: Agent redelegates -> x402 payment -> Venice Vision -> Venice Text).
5. Bot message: _"We've verified your need. Sending $30 USDC now."_
6. Confetti/Pulse animation. (Backend: 1Shot Webhook confirms transfer).

---

### 5. Low-Fidelity Wireframes

**Screen 1: `/ask` (Requester Chat - Mobile View)**

- **Header:** Halo Logo (centered), "Secure & Anonymous" badge.
- **Body:** Gray/Mint chat bubbles.
  - _AI (Left, Gray):_ "Upload a photo of your receipt or bill."
  - _User (Right, Sage):_ [Image Thumbnail] "Power bill is $45."
  - _AI (Left, transparent):_ [Animated bouncing dots... "Reviewing"]
- **Footer:** Text input pill + Camera Icon. No complicated forms.

**Screen 2: `/sponsor` (Donor Dashboard - Desktop View)**

- **Split Screen (For Hackathon Demo):**
  - _Left Side (UI):_ Serif Header: _"Your impact this month."_ Big Sage Green card showing "$65 / $100 Distributed." Below it, a list of anonymized impact statements: _"$20 to groceries," "$45 to electricity."_
  - _Right Side (TerminalDebugger):_ A sleek, black code terminal showing real-time logs of the ERC-7710 sub-delegations and x402 L402 header interceptions.

**Screen 3: `/` (Community Dashboard)**

- **Hero:** Serif font: _"Community Care, Automated."_
- **Middle:** `LiveAidMarquee` scrolling continuously horizontally:
  - `[💚 $30 sent for Prescriptions] • [💚 $15 sent for Transit] • [💚 $50 sent for Textbooks]`
- **Call to Actions:** Two massive buttons. Primary: "I Need Help" (Routes to Ask). Secondary: "Sponsor the Fund" (Routes to Sponsor).

---

### 6. Animation & Micro-interaction Specs (Framer Motion)

Warmth is conveyed through motion. Avoid fast, snappy animations.

- **Donation Pulse (`/sponsor`):** When a donor signs the 7710 delegation, the success card should gently scale up (`scale: 1.05`), emit a soft `halo.accent.light` radial glow that fades out over 2 seconds, mimicking a heartbeat.
- **Chat Handoff (`/ask`):** When the AI is processing the Venice x402 payment, do not show a generic spinner. Show a skeleton text bubble that shimmers gently (duration: `1.5s`, ease: `easeInOut`).
- **Modal Entrances:** All `shadcn/ui` sheets/modals must slide up from the bottom (mobile) with a slight spring physics (`type: "spring", stiffness: 260, damping: 20`).

---

### 7. Accessibility (A11y) Considerations

To truly be a tool for mutual aid, it must be universally accessible.

- **Color Contrast:** Sage Green (`#4A5D23`) on Ivory (`#FAF9F6`) passes WCAG AA for normal text and AAA for large text.
- **Screen Readers (`aria-live`):** The chat interface must use `aria-live="polite"` so screen readers announce when the AI sends a new message or when the 1Shot relayer confirms a transaction.
- **Focus States:** Remove default blue browser outlines. Replace them with a `ring-2 ring-halo-primary ring-offset-2 ring-offset-halo-bg` to maintain theme consistency while ensuring keyboard navigators can see their focus.
- **Cognitive Load:** The Requester UI deliberately removes all crypto jargon. No mentions of "gas," "wallets," "signatures," or "relayers" exist in the `/ask` route. It is purely conversational.

---

### Developer Execution Steps:

1.  Initialize Next.js 15: `npx create-next-app@latest halo --typescript --tailwind --app`.
2.  Install Framer Motion and Lucide Icons: `npm i framer-motion lucide-react`.
3.  Install standard shadcn components: `npx shadcn@latest add button card sheet dialog input toast`.
4.  Copy the Tailwind config above.
5.  Build the `<TerminalDebugger />` component first. This will sit on the right side of your desktop layout and will subscribe to your backend API logs to visibly prove to the judges that the A2A, x402, and 7710 logic is happening under the hood.
