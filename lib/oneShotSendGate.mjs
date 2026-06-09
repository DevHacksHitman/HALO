import {createHash} from "node:crypto";

import {buildUsdcTransferExecution, MAX_GRANT_AMOUNT_ATOMS} from "./haloAgentBridge.mjs";
import {assertPositiveAmount} from "./hex.mjs";
import {
  BASE_SEPOLIA_CHAIN_ID,
  buildBaseSepoliaEstimateRequestFromPermissionContext,
} from "./metaMaskPermissionDecoder.mjs";
import {
  ONESHOT_RELAYER_MAINNET_RPC_URL,
  ONESHOT_RELAYER_RPC_URL,
  ONESHOT_RELAYER_TESTNET_RPC_URL,
  buildSend7710Request,
  sendOneShot7710Transaction,
} from "./oneShot.mjs";
import {METAMASK_CONTEXT_ENV_VAR} from "./oneShotEstimatePreflight.mjs";

export const ESTIMATE_RESULT_ENV_VAR = "HALO_ONESHOT_ESTIMATE_RESULT";
export const LIVE_SEND_ENV_VAR = "HALO_ONESHOT_LIVE";

export const SEND_GATE_STATUS = Object.freeze({
  BLOCKED: "NO_GO_SEND_BLOCKED",
  READY_DRY_RUN: "CONDITIONAL_GO_SEND_DRY_RUN",
  READY_LIVE_SEND: "CONDITIONAL_GO_LIVE_SEND_READY",
});

export function buildOneShotSendGate({
  permissionContext = process.env.HALO_METAMASK_PERMISSION_CONTEXT,
  estimateResult = process.env.HALO_ONESHOT_ESTIMATE_RESULT,
  endpoint = ONESHOT_RELAYER_RPC_URL,
  liveSendEnabled = process.env.HALO_ONESHOT_LIVE === "1",
  allowMainnetEndpoint = process.env.HALO_ALLOW_MAINNET_RELAYER_SEND === "1",
  usdcToken = process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  recipient = "0x4444444444444444444444444444444444444444",
  amount = 25_000_000,
  destinationUrl = "https://example.com/api/webhooks/1shot",
  memo = "Halo Step 14 capped testnet send gate",
  requestId = 14,
} = {}) {
  const issues = [];
  let parsedEstimate = null;
  let estimateHash = null;
  let amountAtoms = null;
  let estimateReport = null;
  let sendRequest = null;

  if (!permissionContext) {
    issues.push(`${METAMASK_CONTEXT_ENV_VAR} is required before a send gate can open`);
  }

  try {
    parsedEstimate = parseEstimateResult(estimateResult);
    estimateHash = hashObject(parsedEstimate);
  } catch (error) {
    issues.push(error.message);
  }

  if (endpoint === ONESHOT_RELAYER_MAINNET_RPC_URL && !allowMainnetEndpoint) {
    issues.push("mainnet 1Shot relayer endpoint is blocked for capped testnet send");
  }

  try {
    amountAtoms = assertPositiveAmount(amount, "grantAmount");
    if (amountAtoms > MAX_GRANT_AMOUNT_ATOMS) {
      issues.push(`grantAmount exceeds cap ${MAX_GRANT_AMOUNT_ATOMS.toString()}`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  if (permissionContext && amountAtoms && amountAtoms <= MAX_GRANT_AMOUNT_ATOMS) {
    try {
      const execution = buildUsdcTransferExecution({usdcToken, recipient, amount: amountAtoms});
      estimateReport = buildBaseSepoliaEstimateRequestFromPermissionContext({
        permissionContext,
        executions: [execution],
        destinationUrl,
        memo,
        requestId,
      });
      sendRequest = buildSend7710Request(estimateReport.params, requestId);
    } catch (error) {
      issues.push(`send request build failed: ${error.message}`);
    }
  }

  const blocked = issues.length > 0;
  const status = blocked
    ? SEND_GATE_STATUS.BLOCKED
    : liveSendEnabled
      ? SEND_GATE_STATUS.READY_LIVE_SEND
      : SEND_GATE_STATUS.READY_DRY_RUN;

  return {
    step: 14,
    title: "Capped 1Shot testnet send gate",
    status,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    endpoint,
    expectedEndpoint: ONESHOT_RELAYER_TESTNET_RPC_URL,
    realContextPresent: Boolean(permissionContext),
    estimateResultPresent: Boolean(parsedEstimate),
    estimateResultHash: estimateHash,
    liveSendEnabled,
    readyForNetworkSend: status === SEND_GATE_STATUS.READY_LIVE_SEND,
    grantAmountAtoms: amountAtoms?.toString() ?? null,
    grantCapAtoms: MAX_GRANT_AMOUNT_ATOMS.toString(),
    issues,
    estimateReport,
    sendRequest,
    noGoFor: status === SEND_GATE_STATUS.READY_LIVE_SEND
      ? ["mainnet_send", "uncapped_payout_claim"]
      : ["live_1shot_send", "live_payout_claim"],
  };
}

export async function runOneShotSendAfterGate(gate, options = {}) {
  if (!gate?.readyForNetworkSend || !gate.estimateReport) {
    throw new Error(`send gate is not ready: ${(gate?.issues ?? []).join("; ") || "missing send request"}`);
  }

  return sendOneShot7710Transaction(gate.estimateReport.params, {
    endpoint: gate.endpoint,
    id: options.id ?? 14,
    fetchImpl: options.fetchImpl,
    allowLive: gate.liveSendEnabled,
  });
}

export function parseEstimateResult(value) {
  if (typeof value === "string") {
    if (value.trim() === "") {
      throw new TypeError(`${ESTIMATE_RESULT_ENV_VAR} is required before live send`);
    }

    try {
      return parseEstimateResult(JSON.parse(value));
    } catch (error) {
      throw new TypeError(`${ESTIMATE_RESULT_ENV_VAR} must be valid JSON: ${error.message}`);
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${ESTIMATE_RESULT_ENV_VAR} must be a JSON object`);
  }

  return value;
}

export function formatOneShotSendGateLogs(gate) {
  const lines = [
    `[1Shot] endpoint=${gate.endpoint}.`,
    `[1Shot] Base Sepolia chainId=${gate.chainId}.`,
    `[MetaMask] real context present=${gate.realContextPresent}.`,
    `[1Shot] estimate receipt present=${gate.estimateResultPresent}.`,
    `[TREASURER] grant amount=${gate.grantAmountAtoms ?? "invalid"} atoms; cap=${gate.grantCapAtoms} atoms.`,
    `[SECURITY] ${LIVE_SEND_ENV_VAR} enabled=${gate.liveSendEnabled}.`,
  ];

  if (gate.estimateResultHash) {
    lines.push(`[1Shot] estimate receipt hash=${gate.estimateResultHash}.`);
  }

  if (gate.sendRequest) {
    lines.push(`[1Shot] send method=${gate.sendRequest.method}.`);
  }

  if (gate.issues.length > 0) {
    for (const issue of gate.issues) {
      lines.push(`[NO-GO] ${issue}.`);
    }
  } else if (gate.readyForNetworkSend) {
    lines.push("[CONDITIONAL GO] Capped testnet send may run; mainnet remains blocked.");
  } else {
    lines.push("[CONDITIONAL GO] Send request is built; network send is still disabled.");
  }

  return lines;
}

function hashObject(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
