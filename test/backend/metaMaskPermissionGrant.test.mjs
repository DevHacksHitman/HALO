import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  DEPENDENCY_PLAN_STATUS,
  buildDependencyDeploymentPlan,
  buildPermissionGrantEnvCommand,
  formatDependencyDeploymentLogs,
  normalizeAuthorizationList,
  parsePermissionGrantJson,
  redactDependencyDeploymentPlan,
  redactGrantDependencies,
  serializePermissionGrantForEnv,
  summarizePermissionGrantShape,
} from "../../lib/metaMaskPermissionGrant.mjs";

const FACTORY = "0xdddddddddddddddddddddddddddddddddddddddd";
const TX_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const grant = {
  chainId: "0x14a34",
  context: "0x1234abcd",
  delegationManager: "0xcccccccccccccccccccccccccccccccccccccccc",
  dependencies: [
    {
      factory: FACTORY,
      factoryData: "0x1234567890abcdef",
    },
  ],
};

describe("MetaMask full grant diagnostics", () => {
  it("parses a local full grant JSON object", () => {
    const parsed = parsePermissionGrantJson(JSON.stringify(grant));

    assert.equal(parsed.context, grant.context);
    assert.equal(parsed.dependencies.length, 1);
  });

  it("summarizes grant keys and authorizationList presence", () => {
    const shape = summarizePermissionGrantShape({...grant, authorizationList: [{chainId: 84532}]});

    assert.ok(shape.grantKeys.includes("context"));
    assert.equal(shape.authorizationListPresent, true);
    assert.equal(shape.authorizationListCount, 1);
    assert.equal(shape.authorizationListValid, true);
  });

  it("passes through at most one wallet-supplied 7702 authorization", () => {
    const authorizationList = normalizeAuthorizationList([
      {
        chainId: 8453,
        address: "0x5555555555555555555555555555555555555555",
        nonce: "0x1",
        yParity: 0,
        r: "0x" + "11".repeat(32),
        s: "0x" + "22".repeat(32),
      },
    ]);

    assert.equal(authorizationList.length, 1);
    assert.equal(authorizationList[0].address, "0x5555555555555555555555555555555555555555");
    assert.throws(
      () => normalizeAuthorizationList([{chainId: 8453}, {chainId: 8453}]),
      /at most one/,
    );
  });

  it("serializes wallet grants with BigInt fields for local env handoff", () => {
    const json = serializePermissionGrantForEnv({
      ...grant,
      permission: {
        type: "erc20-token-periodic",
        data: {
          periodAmount: 100_000_000n,
        },
      },
    });
    const parsed = parsePermissionGrantJson(json);

    assert.equal(parsed.permission.data.periodAmount, "100000000");
    assert.equal(parsed.context, grant.context);
  });

  it("builds dependency deployment transactions without redacting internal tx data", () => {
    const plan = buildDependencyDeploymentPlan({grant});

    assert.equal(plan.status, DEPENDENCY_PLAN_STATUS.BLOCKED);
    assert.equal(plan.dependencyCount, 1);
    assert.equal(plan.deployments[0].tx.to, FACTORY);
    assert.equal(plan.deployments[0].tx.value, "0x0");
    assert.equal(plan.deployments[0].tx.data, grant.dependencies[0].factoryData);
    assert.ok(plan.issues.some((issue) => issue.includes("HALO_METAMASK_DEPENDENCY_TXS")));
  });

  it("marks dependencies ready after deployment tx hashes are recorded", () => {
    const plan = buildDependencyDeploymentPlan({
      grant,
      deploymentTxs: JSON.stringify([TX_HASH]),
    });

    assert.equal(plan.status, DEPENDENCY_PLAN_STATUS.READY);
    assert.equal(plan.dependenciesDeployed, true);
    assert.equal(plan.deployments[0].deploymentTxHash, TX_HASH);
  });

  it("redacts factoryData for public display", () => {
    const plan = buildDependencyDeploymentPlan({grant});
    const redactedPlan = redactDependencyDeploymentPlan(plan);
    const redactedDependencies = redactGrantDependencies(grant.dependencies);

    assert.notEqual(redactedPlan.deployments[0].tx.data, grant.dependencies[0].factoryData);
    assert.equal(redactedPlan.deployments[0].tx.dataRedacted, true);
    assert.equal(redactedDependencies[0].factoryDataRedacted, true);
    assert.ok(redactedDependencies[0].factoryDataHash.startsWith("sha256:"));
  });

  it("builds a private local command for Step 17", () => {
    const command = buildPermissionGrantEnvCommand({
      grantJson: JSON.stringify(grant),
      dependencyTxs: [TX_HASH],
    });

    assert.ok(command.includes("HALO_METAMASK_PERMISSION_GRANT_JSON="));
    assert.ok(command.includes("HALO_METAMASK_DEPENDENCY_TXS="));
    assert.ok(command.includes("scripts/demo_step17_dependency_preflight.sh"));
  });

  it("formats recording-safe dependency logs", () => {
    const logs = formatDependencyDeploymentLogs(buildDependencyDeploymentPlan({grant}));

    assert.ok(logs.some((line) => line.includes("dependencies present=true")));
    assert.ok(logs.some((line) => line.includes("dataHash=sha256:")));
    assert.ok(!logs.join("\n").includes(grant.dependencies[0].factoryData));
  });
});
