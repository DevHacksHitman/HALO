import {createHash} from "node:crypto";

import {
  buildOneShotEstimatePreflight,
  classifyOneShotEstimateResult,
  formatOneShotEstimatePreflightLogs,
  runOneShotEstimateAfterPreflight,
} from "../lib/oneShotEstimatePreflight.mjs";
import {parseDecimalToAtoms} from "../lib/haloPermissions.mjs";
import {fetchOneShotFeePaymentPlan} from "../lib/oneShotFeePlan.mjs";

function hashJson(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function summarizeEstimateResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      resultType: typeof result,
      resultHash: hashJson(result),
    };
  }

  const error = summarizeError(result.error);

  return {
    resultKeys: Object.keys(result).sort(),
    success: typeof result.success === "boolean" ? result.success : null,
    gasUsed: result.gasUsed ?? null,
    error,
    requiredPaymentAmount: result.requiredPaymentAmount ?? null,
    contextPresent: Boolean(result.context),
    resultHash: hashJson(result),
  };
}

function summarizeError(error) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error.slice(0, 240);
  }

  if (typeof error === "object" && !Array.isArray(error)) {
    return {
      code: error.code ?? null,
      message: typeof error.message === "string" ? error.message.slice(0, 240) : null,
      name: typeof error.name === "string" ? error.name : null,
    };
  }

  return String(error).slice(0, 240);
}

function summarizeFeePaymentPlan(plan) {
  if (!plan) {
    return null;
  }

  return {
    chainId: plan.chainId,
    token: plan.token,
    tokenSymbol: plan.tokenSymbol,
    targetAddress: plan.targetAddress,
    feeCollector: plan.feeCollector,
    minFeeAtoms: plan.minFeeAtoms,
    mockFeeAtoms: plan.mockFeeAtoms,
    contextPresent: plan.contextPresent,
    requiredPaymentAmount: plan.requiredPaymentAmount,
  };
}

const liveEstimateRequested = process.env.HALO_ONESHOT_ESTIMATE_LIVE === "1";
const estimateScenario = process.env.HALO_ONESHOT_ESTIMATE_SCENARIO || "fee_and_grant";
const grantAmountUsdc = process.env.HALO_STEP16_GRANT_USDC || "25";
const grantAmountAtoms = parseDecimalToAtoms(grantAmountUsdc);
let feePaymentPlan = null;
let feePaymentIssue = null;

if (liveEstimateRequested) {
  console.log("[1Shot] Discovering fee payment plan before live estimate.");
  try {
    feePaymentPlan = await fetchOneShotFeePaymentPlan();
    console.log(`[1Shot] fee collector=${feePaymentPlan.feeCollector}.`);
    console.log(`[1Shot] relayer target=${feePaymentPlan.targetAddress}.`);
    console.log(`[1Shot] mock fee payment=${feePaymentPlan.mockFeeAtoms} atoms.`);
    console.log("");
  } catch (error) {
    feePaymentIssue = `1Shot fee payment plan failed: ${error.message}`;
    console.log(`[NOT READY] ${feePaymentIssue}.`);
    console.log("");
  }
}

const preflight = buildOneShotEstimatePreflight({
  feePaymentExecution: feePaymentPlan?.execution ?? null,
  feePaymentPlan: summarizeFeePaymentPlan(feePaymentPlan),
  estimateScenario,
  amount: grantAmountAtoms,
  relayerTargetWallet: feePaymentPlan?.targetAddress ?? process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS,
  extraIssues: feePaymentIssue ? [feePaymentIssue] : [],
});

for (const line of formatOneShotEstimatePreflightLogs(preflight)) {
  console.log(line);
}

console.log("");
console.log("[HALO] Step 16 real-context estimate rehearsal:");
console.log(
  JSON.stringify(
    {
      step: 16,
      status: preflight.status,
      chainId: preflight.chainId,
      endpoint: preflight.endpoint,
      realContextPresent: preflight.realContextPresent,
      fullGrantPresent: preflight.fullGrantPresent,
      grantKeys: preflight.grantKeys,
      authorizationListPresent: preflight.authorizationListPresent,
      authorizationListCount: preflight.authorizationListCount,
      dependenciesPresent: preflight.dependenciesPresent,
      dependenciesDeployed: preflight.dependenciesDeployed,
      dependencyCount: preflight.dependencyCount,
      dependencyDeploymentCount: preflight.dependencyDeploymentCount,
      liveEstimateEnabled: preflight.liveEstimateEnabled,
      liveSendEnabled: preflight.liveSendEnabled,
      estimateScenario: preflight.estimateScenario,
      feePaymentIncluded: preflight.feePaymentIncluded,
      grantExecutionIncluded: preflight.grantExecutionIncluded,
      grantAmountAtoms: preflight.grantAmountAtoms,
      feePaymentPlan: preflight.feePaymentPlan,
      executionCount: preflight.executionCount,
      readyForNetworkEstimate: preflight.readyForNetworkEstimate,
      issues: preflight.issues,
      estimateMethod: preflight.estimateReport?.request.method ?? null,
      decodedDelegations: preflight.estimateReport?.decoded.delegationCount ?? null,
      decodedCaveats: preflight.estimateReport?.decoded.caveatCount ?? null,
      firstDelegationDelegate: preflight.firstDelegationDelegate || null,
      expectedRelayerTargetWallet: preflight.expectedRelayerTargetWallet || null,
      delegateMatchesRelayerTarget: preflight.delegateMatchesRelayerTarget,
      contextHash: preflight.estimateReport?.decoded.encodedContextHash ?? null,
      reencodeMatches: preflight.estimateReport?.decoded.reencodeMatches ?? null,
    },
    null,
    2,
  ),
);

if (preflight.readyForNetworkEstimate) {
  console.log("");
  console.log("[1Shot] Running live estimate now. Live send remains disabled.");
  const result = await runOneShotEstimateAfterPreflight(preflight);
  const summary = summarizeEstimateResult(result);
  const classification = classifyOneShotEstimateResult(result);
  console.log("[1Shot] Live estimate result summary:");
  console.log(JSON.stringify({...summary, classification}, null, 2));
  if (classification.apiKeyAcceptedByRelayer === true) {
    console.log("");
    console.log("[AUTH] 1Shot API key was accepted for this relayer call.");
  }
  if (classification.selectorLabel) {
    console.log(`[EVM] Revert surfaced during ${classification.selectorLabel}.`);
  }
  if (summary.success === false) {
    console.log("");
    console.log(`[NO GO] Live estimate returned success=false: ${summary.error ?? "unknown estimate error"}`);
    console.log("[NEXT] Debug the delegated redemption path before any send gate.");
  } else if (summary.success === true) {
    console.log("");
    console.log("[CONDITIONAL GO] Live estimate succeeded. only redacted estimate summary before Step 18 send rehearsal");
  } else {
    console.log("");
    console.log("[CHECK] Live estimate response shape captured. inspect result keys before Step 17 dependecy preflight.");
  }
} else {
  console.log("");
  console.log("[1Shot] Network estimate not called. Add real context and HALO_ONESHOT_ESTIMATE_LIVE=1 after approval.");
}

console.log("");
console.log("No relay send was attempted in Step 16.");
