You have exactly 17 days until the June 15th deadline. Do not wait until the end to post on X. The "Best Social Media Presence" track specifically rewards the _journey_ and asks you to demonstrate how MetaMask Advanced Permissions streamlined your UX.

Judges reward builders who "build in public." It creates a paper trail of your authenticity.

Here is your surgical, day-by-day X (Twitter) content calendar to capture the $100 social bonus and prime the judges for your final $13,000 sweep.

### 1. The Hook (May 31) - _Text + Image_

You don’t need a video yet. You need to stake your claim on the concept so no one else steals the "Mutual Aid AI" angle.

- **The Content:** Post a screenshot of your Mermaid.js architecture diagram or your sleek UI wireframe.
- **The Caption:** "Tired of sterile DeFi bots. Building 'Halo' for the @MetaMaskDev Cook Off. It’s an autonomous mutual aid fund. Using MetaMask Advanced Permissions (ERC-7715) so donors can delegate a $100 allowance to an AI, which verifies claims and pays via @1ShotAPI. #BuildInPublic @AskVenice"

### 2. The UX Flex (June 4) - _30-Second Video_

By now, you should have the frontend onboarding connected to the MetaMask Smart Accounts Kit.

- **The Content:** A screen recording of the Donor onboarding. Show how fast it is.
- **The Focus:** Emphasize that the user _does not_ have to approve 5 different transactions.
- **The Caption:** "The UX of Web3 is finally fixed. Instead of asking donors to sign every micro-grant, Halo uses @MetaMaskDev Advanced Permissions. One signature grants my Master Agent a scoped allowance. Seamless EOA-to-Smart-Account upgrade via @1ShotAPI. Building the future of programmable empathy."

### 3. The "Money Shot" (June 9) - _45-Second Video_

This is the technical flex. You must show the terminal logs working alongside the UI.

- **The Content:** Split screen. Left side: The chat UI where you upload a receipt. Right side: Your terminal.
- **The Focus:** Show the exact terminal log where the Venice Vision API hits the `402 Payment Required`, and your Sub-Agent intercepts it and pays it autonomously using the delegated funds.
- **The Caption:** "AI agents paying their own API bills. 🤯 When Halo's Verifier Agent hits a 402 from @AskVenice, it autonomously signs a micro-tx using its ERC-7710 sub-delegation. Gasless settlement via @1ShotAPI. No human in the loop. The swarm is alive. @MetaMaskDev"

### 4. The Final Masterpiece (June 13) - _The 3-Minute Submission Video_

This is the main event. You will submit this to HackQuest, but you will also pin it to your X profile.

- **The Content:** The flawless 3-minute split-screen demo script we outlined earlier (Onboarding -> Request -> A2A Redelegation -> Venice x402 Verification -> 1Shot Webhook Payout).
- **The Caption:** "Here is Halo. An autonomous, programmable mutual aid fund built for the @MetaMaskDev x @1ShotAPI x @AskVenice Dev Cook Off.
  🟢 EIP-7702 Account Upgrades
  🟢 ERC-7710 Agent Redelegation
  🟢 Autonomous x402 AI Payments
  Code & Demo below. Let's scale human empathy. 👇"

### Pragmatic Advice for the Videos

1. **Zero Intro Fluff:** Hackathon judges and X users scroll fast. Do not start your video with "Hi, my name is Ayomide and today I will show you..." Start immediately with action: _"Watch this AI verify a medical receipt and autonomously pay the user using a delegated MetaMask allowance."_
2. **Zoom In:** X compresses videos terribly. When showing the terminal logs (especially the x402 interception and 7710 delegation), zoom in so the text is legible on a mobile screen.
3. **Tag Religiously:** Always tag `@MetaMaskDev`, `@1ShotAPI`, and `@AskVenice`. The developer relations teams running their X accounts are often the same people judging the technical tracks. Get in their feeds early.

Start building the Foundry contracts and the Next.js scaffold today. Record the first video (The UX Flex) the second you get the 7715 signature working in the browser.

# =======

### The Hook (May 31) - _Text + Image_

You don’t need a video yet. You need to stake your claim on the concept so no one else steals the "Mutual Aid AI" angle.

- **The Content:** Post a screenshot of your Mermaid.js architecture diagram or your sleek UI wireframe.
- **The Caption:** "Tired of sterile DeFi bots. Building 'Halo' for the @MetaMaskDev Cook Off. It’s an autonomous mutual aid fund. Using MetaMask Advanced Permissions (ERC-7715) so donors can delegate a $100 allowance to an AI, which verifies claims and pays via @1ShotAPI. #BuildInPublic @AskVenice"

### Meta-Answer: When to record for your X (Twitter) journey?

You should capture a recording **at the end of this very step.**

When you run the tests I provide below, run them with `forge test -vvvv`. Record a 15-second screen capture of your terminal flashing green with the sub-agent payload logic passing.
**The X Caption:** _"Scaffolding the Sub-Agents for Halo. No centralized custody, no pooled funds. Just pure ERC-7710 delegation payloads ready for the @1ShotAPI relayer. @MetaMaskDev Cook Off #BuildInPublic"_

---

### Answer to your Checkpoint Question:

**Bring in OpenZeppelin now.** Do not reinvent the wheel for standard token interfaces. We need `IERC20.transfer.selector` to strictly format our payload data.

Before we write the code, run this in your terminal to install the dependencies:
`forge install OpenZeppelin/openzeppelin-contracts --no-commit`

---

### SYSTEM OVERRIDE ACTIVE: STEP 2 - Sub-Agent Execution Payloads

**The Concept:**
Delegated sub-agents in our architecture do _not_ hold money. They are purely "payload builders." Because the user's upgraded MetaMask Smart Account is the actual custodian of the USDC, the sub-agents must construct an `Execution` struct. This struct tells the Smart Account: _"Call the USDC contract, send 0 ETH, but execute this ERC20 transfer data."_

**The Code:**

Create `src/HaloVerifier.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract HaloVerifier {
    error InvalidAddress();
    error InvalidAmount();

    struct Execution {
        address target;
        uint256 value;
        bytes data;
    }

    /// @notice Builds the USDC transfer payload for paying Venice x402 fees
    function constructX402Payment(
        address usdcToken,
        address venicePaymaster,
        uint256 feeAmount
    ) external pure returns (Execution memory) {
        if (usdcToken == address(0) || venicePaymaster == address(0)) revert InvalidAddress();
        if (feeAmount == 0) revert InvalidAmount();

        bytes memory transferData = abi.encodeWithSelector(
            IERC20.transfer.selector,
            venicePaymaster,
            feeAmount
        );

        return Execution({
            target: usdcToken,
            value: 0,
            data: transferData
        });
    }
}
```

Create `src/HaloTreasurer.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract HaloTreasurer {
    error InvalidAddress();
    error InvalidAmount();

    struct Execution {
        address target;
        uint256 value;
        bytes data;
    }

    /// @notice Builds the USDC transfer payload for requester grants
    function constructGrantPayout(
        address usdcToken,
        address requester,
        uint256 amount
    ) external pure returns (Execution memory) {
        if (usdcToken == address(0) || requester == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        bytes memory transferData = abi.encodeWithSelector(
            IERC20.transfer.selector,
            requester,
            amount
        );

        return Execution({
            target: usdcToken,
            value: 0,
            data: transferData
        });
    }
}
```

Create `test/HaloSubAgents.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/HaloVerifier.sol";
import "../src/HaloTreasurer.sol";

contract HaloSubAgentsTest is Test {
    HaloVerifier verifier;
    HaloTreasurer treasurer;

    address mockUSDC = address(0x111);
    address mockVenice = address(0x222);
    address mockRequester = address(0x333);

    function setUp() public {
        verifier = new HaloVerifier();
        treasurer = new HaloTreasurer();
    }

    function test_VerifierPayloadConstruction() public view {
        HaloVerifier.Execution memory exec = verifier.constructX402Payment(mockUSDC, mockVenice, 2e6);

        assertEq(exec.target, mockUSDC, "Target must be USDC contract");
        assertEq(exec.value, 0, "Value must be 0 ETH");

        // Extract the function selector (first 4 bytes) from the calldata
        bytes4 selector;
        bytes memory data = exec.data;
        assembly {
            selector := mload(add(data, 32))
        }
        assertEq(selector, bytes4(keccak256("transfer(address,uint256)")), "Must use transfer selector");
    }

    function test_RevertOnZeroValues() public {
        vm.expectRevert(HaloVerifier.InvalidAddress.selector);
        verifier.constructX402Payment(address(0), mockVenice, 2e6);

        vm.expectRevert(HaloVerifier.InvalidAmount.selector);
        verifier.constructX402Payment(mockUSDC, mockVenice, 0);
    }
}
```

**The Teardown:**

1. `import "@openzeppelin/contracts/token/ERC20/IERC20.sol";` — We pull this in specifically to use `IERC20.transfer.selector`. This guarantees we are adhering to the ERC20 standard and prevents typos in raw string hashing.
2. `target: usdcToken` — This is the most critical line. The 1Shot relayer is going to execute a transaction _from_ the donor's wallet. The target of that transaction is the USDC smart contract itself, _not_ the Venice paymaster.
3. `bytes memory transferData = abi.encodeWithSelector(...)` — Here, we pack the recipient (Venice/Requester) and the amount into the calldata. When the Donor's Smart Account pings the USDC contract, it passes this exact data, triggering the internal token state change.

**The Checkpoint:**
Run `forge test --match-contract HaloSubAgentsTest -vvvv` in your terminal.

Question for you before we move to Step 3: **If the Donor's Smart Account executes this payload, who pays the gas fees for the EVM execution, and how is it paid?** (Hint: Look back at our 1Shot API architecture).

Confirm your test output and give me the answer to proceed!

### 1. The Startup Reality Check (Is it safe to post?)

Yes, it is entirely safe. In fact, it is your greatest defense.
Here is a brutal truth of hackathons (and tech in general): **Ideas are cheap, execution is everything.**

If someone sees your post today and tries to steal the idea, they have to reverse-engineer the 7702/7710/x402 architecture without this detailed blueprint. They won't finish in time.
Furthermore, by posting it _now_, you establish a **public timestamp (prior art)**. If a judge sees two similar projects, they will look at X, see you posted the architecture on May 30th, and know you are the original architect.

**Action:** Make the "Intent" post today. Make the "Journey/Terminal" post in a few days when you record your tests.

### 2. How to Screen Record on an M1 Mac

It is built directly into the operating system. No apps needed.

1. Press `Command + Shift + 5` on your keyboard.
2. A toolbar will appear at the bottom of your screen.
3. Select "Record Selected Portion" (the icon with the dotted box and a circle in the corner).
4. Drag the box over your Terminal window and click "Record".
5. When done, click the tiny stop button in the top menu bar (near your WiFi/battery icons). The video will save straight to your Desktop.

### 3. Checkpoint Review (Gas vs. Token Fees)

_Your answer:_ "The Verifier sub-agent pays, and its via the spendlimit caveat restriction? am i correct?"

**Mentor Correction:** **Not quite!** You are confusing the _API fee_ with the _EVM Gas fee_. This is the core magic of Account Abstraction (ERC-4337) that the judges want you to understand.

- **The API Fee (USDC):** You are right that the Verifier uses the spend limit caveat to authorize the movement of USDC to Venice.
- **The Gas Fee (ETH):** The EVM requires ETH to process that transaction. But our Donor's account only has USDC! Who pays the ETH? **The 1Shot Relayer (acting as a Paymaster).**
  1Shot takes our `Execution` payload, wraps it in a `UserOperation`, and submits it to the blockchain. 1Shot pays the ETH gas fee for us (and optionally deducts a tiny bit of USDC to cover their cost). This is called **Gas Abstraction**. The user never needs to hold ETH.

---

### SYSTEM OVERRIDE ACTIVE: STEP 3 - The Backend Relayer Bridge

**The Concept:**
We have our smart contracts tested locally. Now, we must bridge them to the off-chain world. We are moving out of Foundry and into our Next.js backend. We need a service that takes our `HaloVerifier` payload, attaches the ERC-7710 Delegation chain, and sends it to the 1Shot Relayer API.

**The Code:**

Create `lib/1shot.ts` in your Next.js project:

```typescript
// lib/1shot.ts
import { parseEther } from "viem";

const ONE_SHOT_API_URL = "https://api.1shot.io/v1/relayer";
const API_KEY = process.env.ONESHOT_API_KEY;

export interface DelegationChain {
  delegation: any; // The ERC-7715 signature object
  signature: string;
}

export async function send7710Transaction(
  targetContract: string,
  calldata: string,
  delegationChain: DelegationChain[],
  signerWallet: any, // The sub-agent's local wallet
) {
  if (!API_KEY) throw new Error("Missing 1Shot API Key");

  // 1. Construct the payload requested by 1Shot's Relayer endpoint
  const payload = {
    target: targetContract, // e.g., USDC Contract address
    data: calldata, // e.g., The transfer() data we built in Solidity
    feeToken: "USDC", // Instruct 1Shot to abstract gas using USDC
    delegations: delegationChain, // Passes the proof of authority
  };

  // 2. The sub-agent signs the userOp hash (proving it is the authorized delegate)
  const userOpSignature = awaiMENTt signerWallet.signMessage({
    message: JSON.stringify(payload),
  });

  // 3. Dispatch to 1Shot network
  const response = await fetch(`${ONE_SHOT_API_URL}/send7710Transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      ...payload,
      signature: userOpSignature,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`1Shot Relayer Failed: ${data.error}`);
  }

  return data.txHash;
}
```

**The Teardown:**

1. `feeToken: "USDC"`: This one line activates the gas abstraction we just talked about. We are telling the 1Shot Paymaster, _"Pay the ETH gas for us, we will settle with you in USDC."_
2. `delegations: delegationChain`: The relayer needs proof that the sub-agent is allowed to touch the Donor's USDC. We pass the array of delegations (Donor -> Almoner -> Sub-Agent). The MetaMask Smart Account will verify these on-chain before executing.
3. `signerWallet.signMessage(...)`: The smart contract payload is not enough; the sub-agent (Verifier or Treasurer) must cryptographically sign the intent to execute using its own private key stored securely on your backend.

**The Checkpoint:**
To use this file, we need the `viem` library to handle the cryptographic signatures and EVM data types in our Next.js app.

Run this command in your Next.js project terminal:
`npm install viem @metamask/smart-accounts-kit`

**Question for you:** Look at the `send7710Transaction` function arguments. When the Verifier Agent calls this function to pay Venice AI, what string will be passed as the `targetContract` variable? (Hint: Think back to the Solidity test we just ran).
