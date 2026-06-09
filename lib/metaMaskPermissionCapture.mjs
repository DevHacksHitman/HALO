import {BASE_SEPOLIA_CHAIN_ID, HALO_PERMISSION_TYPE} from "./haloPermissions.mjs";
import {normalizeAddress, normalizeHexData} from "./hex.mjs";
import {
  normalizeGrantDependencies,
  summarizePermissionGrantShape,
} from "./metaMaskPermissionGrant.mjs";

export const PERMISSION_CAPTURE_STATUS = Object.freeze({
  HEX_CONTEXT_CAPTURED: "HEX_CONTEXT_CAPTURED",
  DECODE_REQUIRED: "DECODE_REQUIRED_BEFORE_1SHOT",
});

export function summarizePermissionGrant(grant, requestedPermission = {}) {
  if (!grant || typeof grant !== "object" || Array.isArray(grant)) {
    throw new TypeError("permission grant must be an object");
  }

  const context = normalizeHexData(grant.context, "permission grant context");
  const delegationManager = normalizeAddress(grant.delegationManager, "delegationManager");
  const dependencies = normalizeGrantDependencies(grant.dependencies);
  const grantShape = summarizePermissionGrantShape(grant);
  const chainId = normalizeGrantChainId(grant.chainId ?? requestedPermission.chainId);
  const permissionType = requireNonEmptyString(
    grant.permission?.type ?? requestedPermission.permission?.type,
    "permission.type",
  );

  return {
    source: "wallet_requestExecutionPermissions",
    status: PERMISSION_CAPTURE_STATUS.HEX_CONTEXT_CAPTURED,
    relayReadiness: PERMISSION_CAPTURE_STATUS.DECODE_REQUIRED,
    liveRelayReady: false,
    chainId,
    permissionType,
    context,
    contextBytes: byteLength(context),
    contextPreview: shortHex(context),
    delegationManager,
    dependencies,
    dependencyCount: dependencies.length,
    grantKeys: grantShape.grantKeys,
    authorizationListPresent: grantShape.authorizationListPresent,
    authorizationListCount: grantShape.authorizationListCount,
    capturedAt: new Date().toISOString(),
    nextAction:
      "Decode the MetaMask hex permission context into a 7710 delegation array before any 1Shot estimate or send.",
  };
}

export function buildPermissionCaptureReport(grant, requestedPermission = {}) {
  const summary = summarizePermissionGrant(grant, requestedPermission);

  return {
    step: 10,
    title: "MetaMask permission context capture",
    verdict: "CONDITIONAL_GO_CAPTURED_CONTEXT_ONLY",
    noGoFor: ["live_1shot_send", "live_payout_claim"],
    expectedChainId: BASE_SEPOLIA_CHAIN_ID,
    expectedPermissionType: HALO_PERMISSION_TYPE,
    summary,
    safety: [
      "The captured context is still hex-encoded.",
      "1Shot send remains disabled until the context is decoded and estimated.",
      "No donor funds are transferred during capture.",
    ],
  };
}

export function formatPermissionCaptureLogs(report) {
  return [
    `[MetaMask] Captured permission context ${report.summary.contextPreview}.`,
    `[ERC-7715] Permission type ${report.summary.permissionType} on chain ${report.summary.chainId}.`,
    `[MetaMask] Grant keys: ${report.summary.grantKeys.join(", ")}.`,
    `[MetaMask] dependencies=${report.summary.dependencyCount}, authorizationList present=${report.summary.authorizationListPresent}.`,
    `[SECURITY] Context bytes=${report.summary.contextBytes}; decoded delegation array still required.`,
    "[NO-GO] Live 1Shot send remains disabled until decode + estimate pass.",
  ];
}

function normalizeGrantChainId(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    return Number(value);
  }

  if (typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value)) {
    return Number(BigInt(value));
  }

  throw new TypeError("permission grant chainId must be a positive integer");
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function byteLength(hexData) {
  return (hexData.length - 2) / 2;
}

function shortHex(value) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
