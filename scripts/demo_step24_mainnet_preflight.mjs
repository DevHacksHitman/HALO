import {createPublicClient, http} from "viem";

import {A2A_REDELEGATION_LANES} from "../lib/a2aRedelegationProof.mjs";
import {BASE_MAINNET_USDC_ADDRESS} from "../lib/chainProfiles.mjs";
import {
  buildStep24MainnetPreflightPublicSummary,
  classifyStep24MainnetPreflight,
  formatStep24MainnetPreflightLogs,
} from "../lib/mainnetPreflight.mjs";
import {
  buildOneShotEstimatePreflight,
  runOneShotEstimateAfterPreflight,
} from "../lib/oneShotEstimatePreflight.mjs";
import {parseDecimalToAtoms} from "../lib/haloPermissions.mjs";
import {fetchOneShotFeePaymentPlan} from "../lib/oneShotFeePlan.mjs";

function summarizeFeePaymentPlan(plan) {
  if (!plan) {
    return null;
  }

  return {
    chainProfile: plan.chainProfile,
    chainId: plan.chainId,
    token: plan.token,
    tokenSymbol: plan.tokenSymbol,
    targetAddress: plan.targetAddress,
    feeCollector: plan.feeCollector,
    minFeeAtoms: plan.minFeeAtoms,
    initialFeeAtoms: plan.initialFeeAtoms ?? plan.mockFeeAtoms,
    initialFeeUsdc: plan.initialFeeUsdc ?? plan.mockFeeUsdc,
    mockFeeAtoms: plan.mockFeeAtoms,
    mockFeeUsdc: plan.mockFeeUsdc,
    contextPresent: plan.contextPresent,
    requiredPaymentAmount: plan.requiredPaymentAmount,
  };
}

async function lookupBaseMainnetAccountCode(address) {
  const rpcUrl = process.env.BASE_MAINNET_RPC_URL || "";

  if (!address) {
    return {
      attempted: false,
      status: "SKIPPED_NO_ROOT_DELEGATOR",
      address: null,
      code: null,
      codePresent: false,
    };
  }
  if (!rpcUrl) {
    return {
      attempted: false,
      status: "SKIPPED_NO_BASE_MAINNET_RPC_URL",
      address,
      code: null,
      codePresent: false,
    };
  }

  try {
    const publicClient = createPublicClient({transport: http(rpcUrl)});
    const code = await publicClient.getCode({address});
    return {
      attempted: true,
      status: "CONDITIONAL_GO_ACCOUNT_CODE_LOOKUP_OK",
      address,
      code: code || "0x",
      codePresent: Boolean(code && code !== "0x"),
    };
  } catch (error) {
    return {
      attempted: true,
      status: "NO_GO_ACCOUNT_CODE_LOOKUP_FAILED",
      address,
      code: null,
      codePresent: false,
      issue: `Base mainnet account code lookup failed: ${error.message}`,
    };
  }
}

const liveSendInputWasEnabled =
  process.env.HALO_STEP24_LIVE_SEND_INPUT_WAS_ENABLED === "1" ||
  process.env.HALO_ONESHOT_LIVE === "1";
process.env.HALO_CHAIN_PROFILE = "base-mainnet";
process.env.HALO_ONESHOT_LIVE = "0";

const liveEstimateRequested = process.env.HALO_ONESHOT_ESTIMATE_LIVE === "1";
const grantAmountUsdc = process.env.HALO_MAINNET_DEMO_GRANT_USDC || "5";
const grantAmountAtoms = parseDecimalToAtoms(grantAmountUsdc);
let feePaymentPlan = null;
let feePaymentIssue = null;
let accountCodeLookup = null;
let estimateResult = null;
let estimateIssue = null;

console.log("[HALO] Step 24 Base mainnet preflight only.");
console.log(`[SECURITY] HALO_ONESHOT_ESTIMATE_LIVE enabled=${liveEstimateRequested}.`);
console.log(`[SECURITY] HALO_ONESHOT_LIVE input was enabled=${liveSendInputWasEnabled}; Step 24 forces it to false.`);
console.log("[BOUNDARY] This step can estimate, but it never sends, creates a TaskId, mutates /status, or claims paid/mainnet execution.");
console.log("");

if (liveEstimateRequested) {
  console.log("[1Shot] Discovering Base mainnet relayer capabilities and fee plan.");
  try {
    feePaymentPlan = await fetchOneShotFeePaymentPlan({chainProfile: "base-mainnet"});
    console.log(`[1Shot] relayer target=${feePaymentPlan.targetAddress}.`);
    console.log(`[1Shot] fee collector=${feePaymentPlan.feeCollector}.`);
    console.log(`[1Shot] initial fee payment=${feePaymentPlan.initialFeeAtoms ?? feePaymentPlan.mockFeeAtoms} atoms.`);
    console.log("");
  } catch (error) {
    feePaymentIssue = `1Shot mainnet fee payment plan failed: ${error.message}`;
    console.log(`[NO-GO] ${feePaymentIssue}.`);
    console.log("");
  }
}

const buildPreflight = ({accountCode, extraIssues = []} = {}) => buildOneShotEstimatePreflight({
  chainProfile: "base-mainnet",
  requireSmartAccountReadiness: true,
  requireA2A: true,
  a2aLane: A2A_REDELEGATION_LANES.TREASURER_PAYOUT,
  feePaymentExecution: feePaymentPlan?.execution ?? null,
  feePaymentPlan: summarizeFeePaymentPlan(feePaymentPlan),
  amount: grantAmountAtoms,
  mainnetMaxGrantUsdc: grantAmountUsdc,
  accountCode,
  liveEstimateEnabled: liveEstimateRequested,
  liveSendEnabled: false,
  relayerTargetWallet: feePaymentPlan?.targetAddress ?? process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS,
  usdcToken: BASE_MAINNET_USDC_ADDRESS,
  extraIssues: [
    ...(liveEstimateRequested ? [] : ["HALO_ONESHOT_ESTIMATE_LIVE=1 is required for a fresh mainnet estimate"]),
    ...(feePaymentIssue ? [feePaymentIssue] : []),
    ...extraIssues,
  ],
  requestId: 24,
});

let preflight = buildPreflight();

if (liveEstimateRequested) {
  accountCodeLookup = await lookupBaseMainnetAccountCode(preflight.rootDelegator);
  if (accountCodeLookup.attempted) {
    console.log(`[EIP-7702] Base mainnet account code lookup=${accountCodeLookup.status}.`);
    console.log(`[EIP-7702] code present=${accountCodeLookup.codePresent}.`);
    console.log("");
  } else {
    console.log(`[EIP-7702] Base mainnet account code lookup skipped=${accountCodeLookup.status}.`);
    console.log("");
  }
}

preflight = buildPreflight({
  accountCode: accountCodeLookup?.code ?? undefined,
  extraIssues: accountCodeLookup?.status === "NO_GO_ACCOUNT_CODE_LOOKUP_FAILED"
    ? [accountCodeLookup.issue]
    : [],
});

if (preflight.readyForNetworkEstimate) {
  console.log("[1Shot] Running Base mainnet estimate now. No send is attempted.");
  try {
    estimateResult = await runOneShotEstimateAfterPreflight(preflight, {id: 24});
  } catch (error) {
    estimateIssue = `1Shot Base mainnet estimate failed: ${error.message}`;
    console.log(`[NO-GO] ${estimateIssue}.`);
  }
} else {
  console.log("[1Shot] Mainnet estimate not called. Step 24 remains blocked.");
}

const feePaymentPlanSummary = summarizeFeePaymentPlan(feePaymentPlan);
const statusReport = classifyStep24MainnetPreflight({
  preflight,
  estimateResult,
  feePaymentPlan: feePaymentPlanSummary,
  liveSendInputWasEnabled,
  extraIssues: estimateIssue ? [estimateIssue] : [],
});
const publicSummary = buildStep24MainnetPreflightPublicSummary({
  preflight,
  estimateResult,
  feePaymentPlan: feePaymentPlanSummary,
  statusReport,
  accountCodeLookup,
  relayerTargetSource: feePaymentPlan ? "relayer_getCapabilities" : "ONESHOT_RELAYER_TARGET_WALLET_ADDRESS",
});

console.log("");
console.log("[HALO] Step 24 public-safe preflight report:");
for (const line of formatStep24MainnetPreflightLogs(publicSummary)) {
  console.log(line);
}

console.log("");
console.log("[HALO] Step 24 summary:");
console.log(JSON.stringify(publicSummary, null, 2));

console.log("");
console.log("No mainnet relay send was attempted in Step 24.");
