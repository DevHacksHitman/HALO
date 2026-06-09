import {
  buildDependencyDeploymentPlan,
  formatDependencyDeploymentLogs,
  parsePermissionGrantJson,
  redactDependencyDeploymentPlan,
  summarizePermissionGrantShape,
} from "../lib/metaMaskPermissionGrant.mjs";

let grant = null;
let parseIssue = null;

try {
  grant = parsePermissionGrantJson();
} catch (error) {
  parseIssue = error.message;
}

console.log("[MetaMask] Full grant JSON present=" + Boolean(grant) + ".");

if (parseIssue) {
  console.log(`[NOT GO] ${parseIssue}.`);
} else if (!grant) {
  console.log("[NOT GO] HALO_METAMASK_PERMISSION_GRANT_JSON is required for dependency preflight.");
} else {
  const shape = summarizePermissionGrantShape(grant);
  const plan = buildDependencyDeploymentPlan({grant});

  console.log(`[MetaMask] grant keys=${shape.grantKeys.join(", ")}.`);
  console.log(`[MetaMask] authorizationList present=${shape.authorizationListPresent}.`);
  if (shape.authorizationListCount !== null) {
    console.log(`[MetaMask] authorizationList count=${shape.authorizationListCount}.`);
  }

  for (const line of formatDependencyDeploymentLogs(plan)) {
    console.log(line);
  }

  console.log("");
  console.log("[HALO] Step 17 dependency preflight:");
  console.log(
    JSON.stringify(
      {
        step: 17,
        status: plan.status,
        fullGrantPresent: true,
        grantKeys: shape.grantKeys,
        authorizationListPresent: shape.authorizationListPresent,
        authorizationListCount: shape.authorizationListCount,
        dependencyPlan: redactDependencyDeploymentPlan(plan),
        noGoFor: plan.dependenciesDeployed
          ? ["live_1shot_send"]
          : ["live_1shot_estimate", "live_1shot_send"],
      },
      null,
      2,
    ),
  );
}

console.log("");
console.log("No dependency deployment was attempted from this terminal script.");
