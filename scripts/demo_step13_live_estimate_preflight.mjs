import {
  buildOneShotEstimatePreflight,
  formatOneShotEstimatePreflightLogs,
  runOneShotEstimateAfterPreflight,
} from "../lib/oneShotEstimatePreflight.mjs";

const preflight = buildOneShotEstimatePreflight();

for (const line of formatOneShotEstimatePreflightLogs(preflight)) {
  console.log(line);
}

console.log("");
console.log("[HALO] Step 13 preflight report:");
console.log(
  JSON.stringify(
    {
      step: preflight.step,
      status: preflight.status,
      chainId: preflight.chainId,
      endpoint: preflight.endpoint,
      realContextPresent: preflight.realContextPresent,
      liveEstimateEnabled: preflight.liveEstimateEnabled,
      liveSendEnabled: preflight.liveSendEnabled,
      readyForNetworkEstimate: preflight.readyForNetworkEstimate,
      issues: preflight.issues,
      estimateMethod: preflight.estimateReport?.request.method ?? null,
      decodedDelegations: preflight.estimateReport?.decoded.delegationCount ?? null,
    },
    null,
    2,
  ),
);

if (preflight.readyForNetworkEstimate) {
  console.log("");
  console.log("[1Shot] Running live estimate now...");
  const result = await runOneShotEstimateAfterPreflight(preflight);
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("");
  console.log("[1Shot] Network estimate not called. Provide real context and HALO_ONESHOT_ESTIMATE_LIVE=1 after approval.");
}

console.log("");
console.log("[NEXT] If this preflight passes with a real estimate response, prepare a capped testnet send gate.");
