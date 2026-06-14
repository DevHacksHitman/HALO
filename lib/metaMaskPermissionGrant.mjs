import {sha256} from "viem";

import {normalizeAddress, normalizeHexData} from "./hex.mjs";

export const PERMISSION_GRANT_ENV_VAR = "HALO_METAMASK_PERMISSION_GRANT_JSON";
export const DEPENDENCY_TXS_ENV_VAR = "HALO_METAMASK_DEPENDENCY_TXS";

export const DEPENDENCY_PLAN_STATUS = Object.freeze({
  NONE: "CONDITIONAL_GO_NO_DEPENDENCIES",
  READY: "CONDITIONAL_GO_DEPENDENCIES_DEPLOYED",
  BLOCKED: "NO_GO_DEPENDENCIES_UNDEPLOYED",
});

export function parsePermissionGrantJson(value = process.env.HALO_METAMASK_PERMISSION_GRANT_JSON) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(String(value));
  } catch (error) {
    throw new TypeError(`${PERMISSION_GRANT_ENV_VAR} must be valid JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError(`${PERMISSION_GRANT_ENV_VAR} must be a JSON object`);
  }

  return parsed;
}

export function serializePermissionGrantForEnv(grant) {
  if (!grant || typeof grant !== "object" || Array.isArray(grant)) {
    throw new TypeError("permission grant must be an object");
  }

  return JSON.stringify(grant, (_key, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }

    return value;
  });
}

export function summarizePermissionGrantShape(grant) {
  if (!grant || typeof grant !== "object" || Array.isArray(grant)) {
    throw new TypeError("permission grant must be an object");
  }

  const authorizationList = grant.authorizationList;

  return {
    grantKeys: Object.keys(grant).sort(),
    authorizationListPresent: authorizationList !== undefined && authorizationList !== null,
    authorizationListCount: Array.isArray(authorizationList) ? authorizationList.length : null,
    authorizationListValid:
      authorizationList === undefined || authorizationList === null || (
        Array.isArray(authorizationList) &&
        authorizationList.length <= 1 &&
        authorizationList.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
      ),
  };
}

export function normalizeAuthorizationList(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new TypeError("permission grant authorizationList must be an array");
  }

  if (value.length > 1) {
    throw new RangeError("permission grant authorizationList must contain at most one 7702 authorization");
  }

  if (value.length === 0) {
    return undefined;
  }

  const entry = value[0];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("permission grant authorizationList[0] must be an object");
  }

  const normalized = {...entry};
  if (normalized.address !== undefined) {
    normalized.address = normalizeAddress(normalized.address, "authorizationList[0].address");
  }
  for (const key of ["r", "s"]) {
    if (normalized[key] !== undefined) {
      normalized[key] = normalizeHexData(normalized[key], `authorizationList[0].${key}`);
    }
  }
  if (normalized.yParity !== undefined && !["0x0", "0x1", 0, 1, "0", "1"].includes(normalized.yParity)) {
    throw new TypeError("authorizationList[0].yParity must be 0 or 1");
  }

  return [normalized];
}

export function normalizeGrantDependencies(value) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new TypeError("permission grant dependencies must be an array");
  }

  return value.map((dependency, index) => {
    if (!dependency || typeof dependency !== "object" || Array.isArray(dependency)) {
      throw new TypeError(`permission grant dependencies[${index}] must be an object`);
    }

    const factory = normalizeAddress(dependency.factory, `dependencies[${index}].factory`);
    const factoryData = normalizeHexData(dependency.factoryData, `dependencies[${index}].factoryData`);

    return {
      factory,
      factoryData,
      factoryDataBytes: byteLength(factoryData),
      factoryDataPreview: previewFactoryData(factoryData),
      factoryDataHash: hashHex(factoryData),
    };
  });
}

export function buildDependencyDeploymentPlan({
  grant,
  dependencies = grant?.dependencies,
  deploymentTxs = process.env.HALO_METAMASK_DEPENDENCY_TXS,
} = {}) {
  const normalizedDependencies = normalizeGrantDependencies(dependencies);
  const normalizedTxs = normalizeDependencyTxs(deploymentTxs);
  const deployments = normalizedDependencies.map((dependency, index) => ({
    index,
    factory: dependency.factory,
    factoryData: dependency.factoryData,
    factoryDataBytes: dependency.factoryDataBytes,
    factoryDataPreview: dependency.factoryDataPreview,
    factoryDataHash: dependency.factoryDataHash,
    tx: {
      to: dependency.factory,
      value: "0x0",
      data: dependency.factoryData,
    },
    deploymentTxHash: normalizedTxs[index] ?? null,
    deployed: Boolean(normalizedTxs[index]),
  }));

  const dependencyCount = deployments.length;
  const deployedCount = deployments.filter((deployment) => deployment.deployed).length;
  const status = dependencyCount === 0
    ? DEPENDENCY_PLAN_STATUS.NONE
    : deployedCount === dependencyCount
      ? DEPENDENCY_PLAN_STATUS.READY
      : DEPENDENCY_PLAN_STATUS.BLOCKED;
  const issues = status === DEPENDENCY_PLAN_STATUS.BLOCKED
    ? [`${DEPENDENCY_TXS_ENV_VAR} must include ${dependencyCount} dependency deployment tx hash(es)`]
    : [];

  return {
    status,
    dependencyCount,
    deployedCount,
    dependenciesPresent: dependencyCount > 0,
    dependenciesDeployed: dependencyCount === 0 || deployedCount === dependencyCount,
    deployments,
    deploymentTxs: normalizedTxs,
    issues,
  };
}

export function redactDependencyDeploymentPlan(plan) {
  return {
    ...plan,
    deployments: (plan?.deployments ?? []).map((deployment) => ({
      index: deployment.index,
      factory: deployment.factory,
      factoryDataPreview: deployment.factoryDataPreview,
      factoryDataBytes: deployment.factoryDataBytes,
      factoryDataHash: deployment.factoryDataHash,
      deploymentTxHash: deployment.deploymentTxHash,
      deployed: deployment.deployed,
      tx: {
        to: deployment.tx.to,
        value: deployment.tx.value,
        data: deployment.factoryDataPreview,
        dataRedacted: true,
      },
    })),
  };
}

export function redactGrantDependencies(dependencies) {
  return normalizeGrantDependencies(dependencies).map((dependency) => ({
    factory: dependency.factory,
    factoryDataPreview: dependency.factoryDataPreview,
    factoryDataBytes: dependency.factoryDataBytes,
    factoryDataHash: dependency.factoryDataHash,
    factoryDataRedacted: true,
  }));
}

export function buildPermissionGrantEnvCommand({
  grantJson = "",
  dependencyTxs = /** @type {string[]} */ ([]),
  command = "scripts/demo_step17_dependency_preflight.sh",
  recordingSlow = true,
} = {}) {
  if (typeof grantJson !== "string" || grantJson.trim() === "") {
    throw new TypeError("grantJson is required");
  }

  const envParts = [
    ...(recordingSlow ? ["HALO_RECORDING_SLOW=1"] : []),
    `${PERMISSION_GRANT_ENV_VAR}='${grantJson}'`,
  ];

  if (dependencyTxs.length > 0) {
    envParts.push(`${DEPENDENCY_TXS_ENV_VAR}='${JSON.stringify(dependencyTxs)}'`);
  }

  return `${envParts.join(" ")} ${command}`;
}

export function formatDependencyDeploymentLogs(plan) {
  const lines = [
    `[MetaMask] dependencies present=${plan.dependenciesPresent}.`,
    `[MetaMask] dependency count=${plan.dependencyCount}.`,
    `[MetaMask] dependency deployments recorded=${plan.deployedCount}.`,
  ];

  for (const deployment of plan.deployments) {
    lines.push(
      `[MetaMask] dependency[${deployment.index}] factory=${deployment.factory}, dataHash=${deployment.factoryDataHash}.`,
    );
  }

  if (plan.issues.length > 0) {
    for (const issue of plan.issues) {
      lines.push(`[NO-GO] ${issue}.`);
    }
  } else if (plan.dependenciesPresent) {
    lines.push("[CONDITIONAL GO] Permission dependencies have deployment tx hashes.");
  } else {
    lines.push("[CONDITIONAL GO] Permission grant returned no deployable dependencies.");
  }

  return lines;
}

function normalizeDependencyTxs(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((tx, index) => normalizeTxHash(tx, `${DEPENDENCY_TXS_ENV_VAR}[${index}]`));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return [];
    }

    if (trimmed.startsWith("[")) {
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (error) {
        throw new TypeError(`${DEPENDENCY_TXS_ENV_VAR} must be valid JSON or comma-separated tx hashes: ${error.message}`);
      }
      return normalizeDependencyTxs(parsed);
    }

    return trimmed.split(",").map((tx, index) => normalizeTxHash(tx.trim(), `${DEPENDENCY_TXS_ENV_VAR}[${index}]`));
  }

  throw new TypeError(`${DEPENDENCY_TXS_ENV_VAR} must be an array, JSON array, or comma-separated tx hashes`);
}

function normalizeTxHash(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new TypeError(`${label} must be a 32-byte transaction hash`);
  }

  return value.toLowerCase();
}

function hashHex(hexData) {
  return `sha256:${sha256(hexData).slice(2)}`;
}

function byteLength(hexData) {
  return (hexData.length - 2) / 2;
}

function shortHex(value) {
  if (value.length <= 22) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-10)}`;
}

function previewFactoryData(value) {
  if (value === "0x") {
    return "0x";
  }

  if (value.length <= 22) {
    return `0x...${byteLength(value)}b`;
  }

  return shortHex(value);
}
