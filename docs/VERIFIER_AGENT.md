Here is the meticulous architectural specification and implementation guide for the **Halo Verifier Agent**.

This is the central "brain" of your hackathon project. It is where Venice AI's multimodality, the x402 payment protocol, and ERC-7710 redelegations converge.

---

### 1. Architectural Flowchart (The Verification Loop)

```text
[Requester UI] -> Submits { image: File, text: "Need $25 for inhaler" }
       │
       ▼
[Ingestion Queue (BullMQ / Redis)] ---> Prevents Nonce Collisions & Rate Limits
       │
       ▼
[Verifier Agent Wakes Up]
       │
       ├─► 1. [Venice Vision API]
       │      ├─> GET 402 Payment Required (L402 Header)
       │      ├─> Agent signs 7710 delegation -> 1Shot pays x402 Invoice via USDC
       │      └─> Resubmits with Macaroon -> Returns { OCR Text, Date, Total }
       │
       ├─► 2. [Venice Text API (JSON Mode)]
       │      ├─> Prompts: "Does OCR match User Need? Extracted cost?"
       │      ├─> Intercepts x402 -> Pays Invoice via 1Shot
       │      └─> Returns JSON: { "isValid": true, "amount": 25.00, "reason": "Matches pharmacy receipt" }
       │
       ├─► 3. [Logic Gate: Calculate Payout]
       │      ├─> Is requested amount <= receipt amount?
       │      ├─> Is requested amount <= Sub-Agent Allowance ($30)?
       │      └─> Finalize payout amount.
       │
       ├─► 4. [Venice Text API (Empathy Mode)]
       │      ├─> Prompts: "Write a warm 2-sentence message..."
       │      └─> Returns: "Breathe easy. We've covered your inhaler."
       │
       ▼
[Handoff to Treasurer Agent] ---> Passes { payoutAmount, empathyMessage, requesterAddress }
```

---

### 2. Concurrency & Nonce Management (Crucial for Hackathons)

If two users request aid at the exact same millisecond, the Verifier Agent will try to sign two x402 payment transactions simultaneously. This causes an **ERC-4337 UserOp Nonce Collision** on the 1Shot relayer.

**The Solution:** Implement a strict FIFO (First-In-First-Out) queue.

- **Technology:** `BullMQ` (Redis-backed) or a simple server-side in-memory queue (`p-queue` in Node.js for a fast hackathon setup).
- **Design:** The Next.js API route simply pushes the request to the queue and returns a `jobId`. The frontend polls the job status. The Verifier Agent processes the queue sequentially, ensuring the 1Shot relayer nonces increment perfectly.

---

### 3. Implementation Logic: `VerifierService.ts`

This is the complete pseudocode/TypeScript implementation. It abstracts the x402 complexity into a reusable fetcher, making the business logic clean.

#### A. The x402 Fetch Wrapper

This function intercepts 402s, pays them using the 7710 delegation, and retries.

```typescript
// lib/x402Fetcher.ts
import { oneShotRelayer } from "./oneShot";
import { almonerDelegationChain } from "./delegations";

export async function fetchWithX402(
  url: string,
  options: any,
  verifierWallet: any,
) {
  let response = await fetch(url, options);

  if (response.status === 402) {
    console.log("[x402] HTTP 402 Payment Required Intercepted.");

    const l402Header = response.headers.get("www-authenticate");
    const { macaroon, invoice } = parseL402Header(l402Header); // Helper to split header

    console.log(
      `[x402] Invoice received. Autonomously paying via 1Shot/7710...`,
    );

    // 1. Construct the L2 Payment Payload to the Venice Paymaster
    const paymentPayload = constructX402PaymentPayload(invoice);

    // 2. Relay via 1Shot using the ERC-7710 Delegation Chain
    const txHash = await oneShotRelayer.send7710Transaction({
      target: paymentPayload.target,
      data: paymentPayload.data,
      delegationChain: almonerDelegationChain, // [Donor -> Almoner -> Verifier]
      feeToken: "USDC",
      signer: verifierWallet, // Verifier Agent's private key signing the UserOp
    });

    // 3. Wait for settlement, get preimage (proof of payment)
    const preimage = await waitForInvoiceSettlement(invoice.id);

    console.log(`[x402] Payment Success. Resubmitting request...`);

    // 4. Resubmit with the L402 Authorization header
    const retryOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `L402 ${macaroon}:${preimage}`,
      },
    };

    response = await fetch(url, retryOptions);
  }

  return response;
}
```

#### B. The Core Verifier Agent Service

Here is the sequential logic that drives the AI reasoning and verification.

```typescript
// services/VerifierAgent.ts
import { fetchWithX402 } from "../lib/x402Fetcher";

const VENICE_VISION_MODEL = "mistral-31-24b"; // Standard vision model
const VENICE_TEXT_MODEL = "zai-org-glm-5.1"; // Standard text model
const MAX_ALLOWANCE = 30.0; // Capped by ERC-7710 Caveat

export class VerifierAgent {
  async processClaim(imageFile: Buffer, userNeedText: string) {
    try {
      // STEP 1: VISION OCR
      const visionPrompt =
        "Extract the purchased items, total price, and date from this receipt. Be exact.";
      const visionResponse = await this.callVeniceVision(
        imageFile,
        visionPrompt,
      );

      if (
        !visionResponse.content ||
        visionResponse.content.includes("unclear")
      ) {
        return this.fallback(
          "The receipt is a bit blurry. Could you upload a clearer photo?",
        );
      }

      // STEP 2: LOGICAL CROSS-CHECK (JSON MODE)
      const analysisPrompt = `
                User Request: "${userNeedText}"
                Receipt Data: "${visionResponse.content}"
                
                Task: Does the receipt validate the user's request? 
                Output exactly in JSON format:
                { 
                  "isValid": boolean, 
                  "extractedAmount": number, 
                  "reason": "short explanation" 
                }
            `;
      const analysisResult = await this.callVeniceText(analysisPrompt, true); // true = JSON output
      const validation = JSON.parse(analysisResult.content);

      if (!validation.isValid) {
        return this.fallback(
          `I couldn't verify the request. ${validation.reason}. Please try again.`,
        );
      }

      // STEP 3: PAYOUT CALCULATION
      // Rule: Pay the lesser of (Extracted Amount, User Requested Amount, Max Allowance)
      const requestedAmount = this.extractNumberFromText(userNeedText); // Helper regex
      const finalPayout = Math.min(
        validation.extractedAmount,
        requestedAmount,
        MAX_ALLOWANCE,
      );

      // STEP 4: EMPATHY GENERATION
      const empathyPrompt = `
                You are Halo, a community mutual aid fund. 
                A user just successfully received $${finalPayout} for "${userNeedText}".
                Write a warm, 2-sentence encouraging message. Do not sound robotic. Be deeply human.
            `;
      const empathyResponse = await this.callVeniceText(empathyPrompt, false);

      // STEP 5: HANDOFF TO TREASURER
      return {
        status: "APPROVED",
        payoutAmount: finalPayout,
        message: empathyResponse.content,
        reasoning: validation.reason,
      };
    } catch (error) {
      console.error("[VerifierAgent] Processing Error:", error);
      return this.fallback(
        "Our network is a bit overwhelmed right now. Your community is still here for you. Please try again in a few minutes.",
      );
    }
  }

  // --- Private Helpers ---

  private async callVeniceVision(imageBuffer: Buffer, prompt: string) {
    const base64Image = imageBuffer.toString("base64");
    const payload = {
      model: VENICE_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
    };

    const res = await fetchWithX402(
      "https://api.venice.ai/api/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      process.env.VERIFIER_PRIVATE_KEY,
    );

    return (await res.json()).choices[0].message;
  }

  private async callVeniceText(prompt: string, jsonMode: boolean) {
    const payload = {
      model: VENICE_TEXT_MODEL,
      response_format: jsonMode ? { type: "json_object" } : { type: "text" },
      messages: [{ role: "user", content: prompt }],
    };

    const res = await fetchWithX402(
      "https://api.venice.ai/api/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      process.env.VERIFIER_PRIVATE_KEY,
    );

    return (await res.json()).choices[0].message;
  }

  private fallback(message: string) {
    return { status: "FAILED", payoutAmount: 0, message };
  }
}
```

---

### 4. Fallback Handling Strategy

No AI is perfect. The Verifier must fail gracefully to preserve the "empathetic" UX of Halo.

- **Unreachable API (503s):** Caught in the `try/catch` block. The agent returns a warm "Network overwhelmed" message rather than a cold "Error 500".
- **Unclear Images (Blurry/Dark):** If Venice Vision returns low confidence or mentions "unclear", the JSON verification will flag `isValid: false`. The fallback pushes a message to the chat interface: _"The receipt is a bit blurry for me to read. Could you move to better lighting and snap another photo?"_
- **Spam/Fraud (Mismatch):** If a user asks for "Insulin" but uploads a receipt for "PlayStation 5", Venice Text will output `{ isValid: false, reason: "Receipt items do not match medical necessity." }`. The fallback handles this gently: _"I couldn't verify this receipt against your request. Please ensure you upload the correct document."_

### 5. Why This Implementation Wins

1.  **Visually Demonstrable:** In your demo video, you will console.log exactly when the `402 Payment Required` hits, and when the Verifier signs the 7710 transaction to pay it. This proves to the judges that your agent is economically autonomous.
2.  **Complex Reasoning Engine:** It uses Vision to extract unstructured data, Text to structure it (JSON), and Text again to humanize it. This perfectly satisfies the "Combine multiple Venice endpoints" requirement.
3.  **Strictly Capped by Smart Contracts:** The `Math.min(..., MAX_ALLOWANCE)` logic is enforced at the software layer, but even if the AI hallucinates and tries to payout $10,000, the `ERC20SpendLimit` caveat attached to the ERC-7710 delegation on the Blockchain will force the 1Shot relayer to revert the transaction. This is the ultimate proof of secure A2A architecture.
