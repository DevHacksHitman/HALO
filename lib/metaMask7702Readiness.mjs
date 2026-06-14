import {getSmartAccountsEnvironment} from "@metamask/smart-accounts-kit";

import {normalizeAddress} from "./hex.mjs";

export const EIP7702_DELEGATION_PREFIX = "0xef0100";

export const SMART_ACCOUNT_7702_STATUS = Object.freeze({
  READY_EXPECTED_DELEGATOR: "CONDITIONAL_GO_7702_EXPECTED_DELEGATOR",
  READY_AUTHORIZATION_LIST: "CONDITIONAL_GO_7702_AUTHORIZATION_LIST",
  READY_DEPENDENCIES: "CONDITIONAL_GO_7702_DEPENDENCIES_PENDING_DEPLOY",
  BLOCKED_NO_PATH: "NO_GO_7702_NO_SMART_ACCOUNT_PATH",
  BLOCKED_UNEXPECTED_DELEGATOR: "NO_GO_7702_UNEXPECTED_DELEGATOR",
  CHECK_NON_7702_CODE: "CHECK_ACCOUNT_CODE_NOT_7702",
});

/**
 * @param {{
 *   accountCode?: string | null,
 *   expectedDelegatorAddress?: string,
 *   chainId?: number | string,
 *   authorizationList?: unknown,
 *   dependencyCount?: number,
 *   dependenciesDeployed?: boolean,
 * }} [options]
 */
export function classifySmartAccount7702Readiness({
  accountCode,
  expectedDelegatorAddress = process.env.HALO_EXPECTED_7702_DELEGATOR_ADDRESS,
  chainId,
  authorizationList,
  dependencyCount = 0,
  dependenciesDeployed = false,
} = {}) {
  const issues = [];
  const code = normalizeCode(accountCode);
  const expectedDelegatorInput = expectedDelegatorAddress || lookupExpectedDelegatorAddress(chainId);
  const expectedDelegator = expectedDelegatorInput
    ? normalizeAddress(expectedDelegatorInput, "expectedDelegatorAddress")
    : "";
  const authorizationCount = Array.isArray(authorizationList) ? authorizationList.length : 0;
  const dependencyTotal = Number(dependencyCount || 0);
  const hasCode = Boolean(code && code !== "0x");
  const eip7702Delegator = extractEip7702Delegator(code);

  if (eip7702Delegator) {
    if (expectedDelegator && eip7702Delegator !== expectedDelegator) {
      issues.push(`account EIP-7702 delegator ${eip7702Delegator} does not match expected ${expectedDelegator}`);
      return buildReport(SMART_ACCOUNT_7702_STATUS.BLOCKED_UNEXPECTED_DELEGATOR, {
        code,
        hasCode,
        eip7702Delegator,
        expectedDelegator,
        authorizationCount,
        dependencyCount: dependencyTotal,
        dependenciesDeployed,
        issues,
      });
    }

    return buildReport(SMART_ACCOUNT_7702_STATUS.READY_EXPECTED_DELEGATOR, {
      code,
      hasCode,
      eip7702Delegator,
      expectedDelegator,
      authorizationCount,
      dependencyCount: dependencyTotal,
      dependenciesDeployed,
      issues,
    });
  }

  if (hasCode) {
    issues.push("account has code, but it is not an EIP-7702 delegated account bytecode prefix");
    return buildReport(SMART_ACCOUNT_7702_STATUS.CHECK_NON_7702_CODE, {
      code,
      hasCode,
      eip7702Delegator: "",
      expectedDelegator,
      authorizationCount,
      dependencyCount: dependencyTotal,
      dependenciesDeployed,
      issues,
    });
  }

  if (authorizationCount === 1) {
    return buildReport(SMART_ACCOUNT_7702_STATUS.READY_AUTHORIZATION_LIST, {
      code,
      hasCode,
      eip7702Delegator: "",
      expectedDelegator,
      authorizationCount,
      dependencyCount: dependencyTotal,
      dependenciesDeployed,
      issues,
    });
  }

  if (dependencyTotal > 0) {
    if (!dependenciesDeployed) {
      issues.push("MetaMask grant dependencies must be deployed before estimate/send");
    }

    return buildReport(SMART_ACCOUNT_7702_STATUS.READY_DEPENDENCIES, {
      code,
      hasCode,
      eip7702Delegator: "",
      expectedDelegator,
      authorizationCount,
      dependencyCount: dependencyTotal,
      dependenciesDeployed,
      issues,
    });
  }

  issues.push("no deployed 7702 account code, authorizationList, or deployable dependency path was found");
  return buildReport(SMART_ACCOUNT_7702_STATUS.BLOCKED_NO_PATH, {
    code,
    hasCode,
    eip7702Delegator: "",
    expectedDelegator,
    authorizationCount,
    dependencyCount: dependencyTotal,
    dependenciesDeployed,
    issues,
  });
}

export async function getAccountCode7702Readiness({
  publicClient,
  address,
  expectedDelegatorAddress,
  chainId,
  authorizationList,
  dependencyCount,
  dependenciesDeployed,
} = {}) {
  if (!publicClient || typeof publicClient.getCode !== "function") {
    throw new TypeError("publicClient.getCode is required for 7702 readiness");
  }

  const account = normalizeAddress(address, "address");
  const code = await publicClient.getCode({address: account});
  return classifySmartAccount7702Readiness({
    accountCode: code,
    expectedDelegatorAddress,
    chainId,
    authorizationList,
    dependencyCount,
    dependenciesDeployed,
  });
}

export function formatSmartAccount7702ReadinessLogs(report) {
  const lines = [
    `[EIP-7702] status=${report.status}.`,
    `[EIP-7702] code present=${report.hasCode}.`,
    `[EIP-7702] delegator=${report.eip7702Delegator || "none"}.`,
    `[EIP-7702] authorizationList count=${report.authorizationCount}.`,
    `[MetaMask] dependencies=${report.dependencyCount}, deployed=${report.dependenciesDeployed}.`,
  ];

  for (const issue of report.issues) {
    lines.push(`[NO-GO] ${issue}.`);
  }

  return lines;
}

function buildReport(status, details) {
  const blocked = status.startsWith("NO_GO");
  return {
    status,
    readyForLiveSend: !blocked && details.issues.length === 0,
    ...details,
    noGoFor: blocked ? ["live_1shot_send", "mainnet_send"] : [],
  };
}

function normalizeCode(value) {
  if (!value || value === "0x") {
    return "0x";
  }

  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new TypeError("accountCode must be hex data");
  }

  return value.toLowerCase();
}

function extractEip7702Delegator(code) {
  if (!code || code === "0x" || !code.startsWith(EIP7702_DELEGATION_PREFIX)) {
    return "";
  }

  const addressHex = code.slice(EIP7702_DELEGATION_PREFIX.length);
  if (!/^[0-9a-f]{40}$/.test(addressHex)) {
    return "";
  }

  return `0x${addressHex}`;
}

function lookupExpectedDelegatorAddress(chainId) {
  if (chainId === undefined || chainId === null || chainId === "") {
    return "";
  }

  try {
    return getSmartAccountsEnvironment(Number(chainId)).implementations.EIP7702StatelessDeleGatorImpl;
  } catch {
    return "";
  }
}
