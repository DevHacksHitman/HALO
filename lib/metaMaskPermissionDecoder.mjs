import {createHash} from "node:crypto";

import {decodeDelegations, encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {normalizeHexData} from "./hex.mjs";
import {
  buildEstimate7710Request,
  buildOneShot7710Params,
  normalizePermissionContext,
} from "./oneShot.mjs";
import {BASE_SEPOLIA_CHAIN_ID, getHaloChainProfile} from "./chainProfiles.mjs";

export {BASE_SEPOLIA_CHAIN_ID};

export function decodeMetaMaskPermissionContext(encodedContext) {
  const normalizedEncodedContext = normalizeHexData(encodedContext, "permissionContext");
  let decodedDelegations;

  try {
    decodedDelegations = decodeDelegations(normalizedEncodedContext);
  } catch (error) {
    throw new TypeError(`permissionContext could not be decoded as MetaMask delegations: ${error.message}`);
  }

  const permissionContext = normalizePermissionContext(decodedDelegations);
  const reencodedContext = normalizeHexData(encodeDelegations(decodedDelegations), "reencoded permissionContext");

  return {
    encodedContext: normalizedEncodedContext,
    encodedContextHash: hashHex(normalizedEncodedContext),
    encodedByteLength: byteLength(normalizedEncodedContext),
    delegationCount: permissionContext.length,
    caveatCount: permissionContext.reduce((count, delegation) => count + delegation.caveats.length, 0),
    permissionContext,
    reencodedContextHash: hashHex(reencodedContext),
    reencodeMatches: reencodedContext === normalizedEncodedContext,
    relayReady: true,
  };
}

export function buildEstimateRequestFromPermissionContext({
  permissionContext,
  executions,
  chainId = getHaloChainProfile().chainId,
  destinationUrl,
  context,
  taskId,
  authorizationList,
  requestId = 1,
}) {
  const decoded = decodeMetaMaskPermissionContext(permissionContext);
  const params = buildOneShot7710Params({
    chainId,
    permissionContext: decoded.permissionContext,
    executions,
    destinationUrl,
    context,
    taskId,
    authorizationList,
  });

  return {
    chainId,
    estimateOnly: true,
    liveSendEnabled: false,
    decoded,
    params,
    request: buildEstimate7710Request(params, requestId),
  };
}

export function buildBaseSepoliaEstimateRequestFromPermissionContext(options) {
  return buildEstimateRequestFromPermissionContext({
    ...options,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
}

export function formatDecodedPermissionEstimateLogs(report) {
  return [
    `[MetaMask] decoded delegations=${report.decoded.delegationCount}, caveats=${report.decoded.caveatCount}.`,
    `[MetaMask] context bytes=${report.decoded.encodedByteLength}, hash=${report.decoded.encodedContextHash}.`,
    `[MetaMask] reencode check=${report.decoded.reencodeMatches ? "pass" : "mismatch"}.`,
    `[1Shot] chainId=${report.chainId}.`,
    `[1Shot] estimate method=${report.request.method}.`,
    "[NO-GO] Live send remains disabled; this is an estimate request boundary.",
  ];
}

function hashHex(hexData) {
  return `sha256:${createHash("sha256").update(Buffer.from(hexData.slice(2), "hex")).digest("hex")}`;
}

function byteLength(hexData) {
  return (hexData.length - 2) / 2;
}
