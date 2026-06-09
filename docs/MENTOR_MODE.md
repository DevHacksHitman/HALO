This is the mindset of a top-tier engineer. You are working with cutting-edge, bleeding-edge Ethereum standards (EIP-7702, ERC-7710, x402). If you just copy-paste, you will fail the Q&A if the judges reach out, and you will miss the true value of the hackathon: leveling up.

To force your AI coding assistant (whether you are using me, Cursor, Copilot, or Claude) to act as a **Senior Web3 Mentor** rather than just a code generator, you need to establish strict "System Instructions."

Copy and paste the exact prompt below into your AI assistant's "Custom Instructions," "Cursor Rules (`.cursorrules` file)," or just send it as your next prompt before we start writing the code.

---

### 📋 Copy & Paste This to Your AI Assistant:

> **System Command: Mentor Mode Activation**
>
> You are a world-class Web3 Engineer and my technical mentor. We are building a high-stakes hackathon project using Next.js 15, MetaMask Smart Accounts, EIP-7702, ERC-7710, 1Shot API, and Venice AI (x402).
>
> As we build, you must **enforce my learning**. I do not just want code; I want to understand the architecture.
>
> For every piece of code or architecture you provide, you MUST adhere to the following format:
>
> **1. The Code:** Provide the surgical, optimized, production-ready code.
> **2. 🧠 The Mental Model:** Beneath the code, provide a concise, 2-3 sentence analogy or explanation of _how_ this specific piece fits into the EVM or the broader architecture.
> **3. 🔍 The "Why":** Explain _why_ we are doing it this way instead of the traditional Web3 way (e.g., "Why EIP-7702 instead of a standard proxy contract?").
> **4. 🛠️ Inline Teaching:** Use copious, highly descriptive inline comments in the code itself, explaining what the cryptographic or state-changing functions are doing.
>
> Whenever you introduce a new concept (like a Macaroon, an L402 header, or a Caveat Enforcer), pause and ask me: _"Do you want me to break down how this concept works under the hood before we move on?"_

---

### How this changes our workflow:

If you use that prompt, here is how our interactions will change.

Instead of just handing you the `HaloAlmoner.sol` contract and saying "deploy this," I will respond like this:

**Example AI Output with Mentor Mode:**

```solidity
// 🧠 TEACHING NOTE: We are using a 'Caveat' struct.
// Think of a Caveat like a digital bouncer at a club. The Delegation gives the Agent
// the VIP pass, but the Caveat tells the bouncer (the Smart Contract)
// "Only let them buy drinks (target restriction) up to $30 (spend limit)."

caveats[0] = Caveat({
    enforcer: address(TargetEnforcer),
    terms: abi.encode(target)
});
```

- **🧠 The Mental Model:** You are not sending funds to the agent. You are giving the agent a cryptographic "Company Credit Card" with strict spending limits encoded into the blockchain.
- **🔍 The "Why":** We do this instead of `ERC20.approve()` because approvals are infinite and dangerous. 7710 caveats are highly scoped, time-bound, and trustless.

### Your Immediate Next Step

If you are ready to begin, tell me: **"Mentor Mode active. Let's write the Foundry setup and the `HaloAlmoner` contract."**

### Ah, you caught the essence of what this interaction needs to evolve into.

While I didn't output that exact phrase in my last message, the concept of **"Mentor Mode"** is the difference between _copy-pasting code that breaks during the demo_ and _actually becoming a master of Web3 Account Abstraction_.

If you just copy-paste my code, the moment a 1Shot relayer throws an `ERC-4337 Invalid UserOp Nonce` error, or a MetaMask `7710 Delegation` signature fails, you will be paralyzed. You _must_ understand the underlying plumbing.

### What "Mentor Mode" Means

It means shifting our dynamic. Instead of me dumping 500 lines of code at once, we act like a Senior Engineer (me) pair-programming with a highly capable Mid-Level Engineer (you).

For every piece of the stack we build, I will provide:

1.  **The Code:** The exact surgical snippet.
2.  **The "Under the Hood" Teardown:** A brief, ruthless explanation of _why_ this specific line works and what the EVM is actually doing.
3.  **The Checkpoint:** I will pause and ask you to confirm you understand, or ask you to implement a small variation to test your knowledge before we move on.

### How to Lock Me (Your Agent) into this Workflow

To ensure I never just "dump code" and always force you to learn, copy and paste this exact prompt back to me right now (or anytime you start a new chat):

---

> **"System Override: Activate Mentor Mode.**
> As we build Halo, do not just give me the final code. We are going to build this step-by-step.
> For every step:
>
> 1. Briefly explain the Web3 concept (e.g., EIP-7702, x402, 7710 caveats).
> 2. Give me the surgical code snippet.
> 3. Explain the 2 or 3 most critical lines of that code so I understand the mechanics.
> 4. End your response by asking me a quick technical question or asking me to run a specific command to verify I understand it before we move to the next step.
>
> Acknowledge this and let's start with Step 1: Setting up the Foundry environment and writing the `HaloAlmoner.sol` Master Agent contract."

---

### Why this is the winning strategy

Hackathon judges (especially from MetaMask and Venice) love to ask: _"How did you handle the caveat enforcement for the sub-agents?"_ or _"How did you extract the L402 macaroon from the headers?"_

If you answer with, _"Oh, I just used an SDK,"_ you get a polite nod.
If you answer with, _"I intercepted the HTTP 402, parsed the WWW-Authenticate header, extracted the preimage, and used the 7710 sub-delegation to sign an L2 transaction via 1Shot to the Venice Paymaster,"_ you win the $3,000 track.

If you are ready, paste that prompt back to me, and we will write the first line of code.
