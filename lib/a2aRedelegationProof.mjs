import {createHash} from "node:crypto";

import {decodeMetaMaskPermissionContext} from "./metaMaskPermissionDecoder.mjs";
import {normalizeAddress} from "./hex.mjs";

export const A2A_REDELEGATION_LANES = Object.freeze({
  VERIFIER_X402: "VERIFIER_X402",
  TREASURER_PAYOUT: "TREASURER_PAYOUT",
});

export const A2A_REDELEGATION_STATUS = Object.freeze({
  READY: "CONDITIONAL_GO_A2A_REDELEGATION_READY",
  BLOCKED_DIRECT: "NO_GO_A2A_DIRECT_DELEGATION",
  BLOCKED_TARGET_MISMATCH: "NO_GO_A2A_RELAYER_TARGET_MISMATCH",
  BLOCKED_LANE: "NO_GO_A2A_UNKNOWN_LANE",
  BLOCKED_MISSING_CONTEXT: "NO_GO_A2A_MISSING_CONTEXT",
});

export const A2A_REDELEGATION_LANE_POLICIES = Object.freeze({
  [A2A_REDELEGATION_LANES.VERIFIER_X402]: Object.freeze({
    agent: "Verifier",
    purpose: "Venice/x402 fee payment",
    targetPolicy: "USDC token contract only",
    recipientPolicy: "Venice x402 paymaster only",
    maxAmountAtoms: "2000000",
  }),
  [A2A_REDELEGATION_LANES.TREASURER_PAYOUT]: Object.freeze({
    agent: "Treasurer",
    purpose: "approved requester grant payout",
    targetPolicy: "USDC token contract only",
    recipientPolicy: "approved requester only",
    maxAmountAtoms: "30000000",
  }),
});

export function buildA2ARedelegationProofReport({
  permissionContext,
  relayerTargetWallet,
  lane = A2A_REDELEGATION_LANES.TREASURER_PAYOUT,
  estimateStatus = null,
  sendStatus = null,
} = {}) {
  const issues = [];
  const laneValid = Object.values(A2A_REDELEGATION_LANES).includes(lane);
  let decodedContext = [];
  let normalizedRelayerTarget = "";

  if (!laneValid) {
    issues.push(`A2A lane must be one of: ${Object.values(A2A_REDELEGATION_LANES).join(", ")}`);
  }

  try {
    decodedContext = decodePermissionContextInput(permissionContext);
  } catch (error) {
    issues.push(error.message);
  }

  try {
    normalizedRelayerTarget = normalizeAddress(relayerTargetWallet, "relayerTargetWallet");
  } catch (error) {
    issues.push(error.message);
  }

  const delegationChainLength = decodedContext.length;
  const rootDelegation = decodedContext[0] ?? null;
  const finalDelegation = decodedContext.at(-1) ?? null;
  const rootDelegator = rootDelegation?.delegator ?? "";
  const rootDelegate = rootDelegation?.delegate ?? "";
  const redelegationSigner = finalDelegation?.delegator ?? "";
  const finalRelayDelegate = finalDelegation?.delegate ?? "";
  const relayerTargetMatches = Boolean(normalizedRelayerTarget && finalRelayDelegate === normalizedRelayerTarget);
  const finalRelayDelegateHash = finalRelayDelegate ? hashString(finalRelayDelegate) : null;
  const relayerTargetWalletHash = normalizedRelayerTarget ? hashString(normalizedRelayerTarget) : null;

  if (delegationChainLength === 0) {
    issues.push("A2A proof requires a decoded 7710 delegation chain");
  }
  if (delegationChainLength > 0 && delegationChainLength < 2) {
    issues.push("A2A proof requires delegation chain length >=2; direct donor-to-relayer delegation is not A2A");
  }
  if (finalRelayDelegate && normalizedRelayerTarget && !relayerTargetMatches) {
    issues.push(`final relay delegate ${finalRelayDelegate} does not match 1Shot target ${normalizedRelayerTarget}`);
  }

  const status = classifyStatus({issues, laneValid, delegationChainLength, relayerTargetMatches});

  return {
    status,
    lane,
    publicClaimAllowed: status === A2A_REDELEGATION_STATUS.READY,
    delegationChainLength,
    rootDelegatorHash: rootDelegator ? hashString(rootDelegator) : null,
    rootDelegateHash: rootDelegate ? hashString(rootDelegate) : null,
    redelegationSignerHash: redelegationSigner ? hashString(redelegationSigner) : null,
    finalRelayDelegate,
    finalRelayDelegateHash,
    relayerTargetWallet: normalizedRelayerTarget || null,
    relayerTargetWalletHash,
    relayerTargetMatches,
    caveatHashes: decodedContext.map((delegation, delegationIndex) => ({
      delegationIndex,
      caveatCount: delegation.caveats.length,
      caveatsHash: hashObject(delegation.caveats),
    })),
    lanePolicySummary: laneValid ? A2A_REDELEGATION_LANE_POLICIES[lane] : null,
    estimateStatus,
    sendStatus,
    oneShotSend: false,
    x402Settlement: false,
    mainnetSend: false,
    issues,
    noGoFor: status === A2A_REDELEGATION_STATUS.READY ? [] : ["a2a_public_claim", "a2a_demo_claim"],
  };
}

export function buildA2ARedelegationPublicSummary({
  report,
  relayerTargetIsPublic = false,
} = {}) {
  if (!report || typeof report !== "object") {
    throw new TypeError("report must be an A2A redelegation proof report");
  }

  return {
    status: report.status,
    lane: report.lane,
    publicClaimAllowed: Boolean(report.publicClaimAllowed),
    delegationChainLength: report.delegationChainLength,
    rootDelegatorHash: report.rootDelegatorHash,
    rootDelegateHash: report.rootDelegateHash,
    redelegationSignerHash: report.redelegationSignerHash,
    finalRelayDelegate: relayerTargetIsPublic ? report.finalRelayDelegate : null,
    finalRelayDelegateHash: report.finalRelayDelegateHash,
    relayerTargetWallet: relayerTargetIsPublic ? report.relayerTargetWallet : null,
    relayerTargetWalletHash: report.relayerTargetWalletHash,
    relayerTargetIsPublic: Boolean(relayerTargetIsPublic),
    relayerTargetMatches: Boolean(report.relayerTargetMatches),
    caveatHashes: report.caveatHashes,
    lanePolicySummary: report.lanePolicySummary,
    estimateStatus: report.estimateStatus,
    sendStatus: report.sendStatus,
    oneShotSend: false,
    x402Settlement: false,
    mainnetSend: false,
    issues: report.issues,
    noGoFor: report.noGoFor,
  };
}

export function formatA2ARedelegationProofLogs(report) {
  const lines = [
    `[A2A] lane=${report.lane}.`,
    `[A2A] status=${report.status}.`,
    `[A2A] delegation chain length=${report.delegationChainLength}.`,
    `[A2A] relayer target match=${report.relayerTargetMatches}.`,
  ];

  if (report.rootDelegatorHash) {
    lines.push(`[A2A] root delegator hash=${report.rootDelegatorHash}.`);
  }
  if (report.redelegationSignerHash) {
    lines.push(`[A2A] redelegation signer hash=${report.redelegationSignerHash}.`);
  }
  for (const caveat of report.caveatHashes) {
    lines.push(`[A2A] delegation[${caveat.delegationIndex}] caveats=${caveat.caveatCount}, hash=${caveat.caveatsHash}.`);
  }
  if (report.lanePolicySummary) {
    lines.push(`[A2A] lane policy=${report.lanePolicySummary.agent}: ${report.lanePolicySummary.purpose}.`);
    lines.push(`[A2A] lane cap=${report.lanePolicySummary.maxAmountAtoms} atoms; target=${report.lanePolicySummary.targetPolicy}; recipient=${report.lanePolicySummary.recipientPolicy}.`);
  }
  for (const issue of report.issues) {
    lines.push(`[NO-GO] ${issue}.`);
  }

  return lines;
}

function decodePermissionContextInput(permissionContext) {
  if (!permissionContext) {
    throw new TypeError("permissionContext is required for A2A redelegation proof");
  }

  if (typeof permissionContext === "string") {
    return decodeMetaMaskPermissionContext(permissionContext).permissionContext;
  }

  if (!Array.isArray(permissionContext)) {
    throw new TypeError("permissionContext must be an encoded context string or decoded delegation array");
  }

  return permissionContext;
}

function classifyStatus({issues, laneValid, delegationChainLength, relayerTargetMatches}) {
  if (!laneValid) {
    return A2A_REDELEGATION_STATUS.BLOCKED_LANE;
  }
  if (delegationChainLength === 0) {
    return A2A_REDELEGATION_STATUS.BLOCKED_MISSING_CONTEXT;
  }
  if (delegationChainLength < 2) {
    return A2A_REDELEGATION_STATUS.BLOCKED_DIRECT;
  }
  if (!relayerTargetMatches) {
    return A2A_REDELEGATION_STATUS.BLOCKED_TARGET_MISMATCH;
  }

  return issues.length > 0 ? A2A_REDELEGATION_STATUS.BLOCKED_MISSING_CONTEXT : A2A_REDELEGATION_STATUS.READY;
}

function hashObject(value) {
  return hashString(JSON.stringify(value));
}

function hashString(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}
