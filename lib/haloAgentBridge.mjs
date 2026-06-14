import {decodeErc20Transfer, encodeErc20Transfer} from "./erc20.mjs";
import {assertPositiveAmount, normalizeAddress} from "./hex.mjs";
import {buildOneShot7710Params, buildSend7710Request, ONESHOT_RELAYER_RPC_URL} from "./oneShot.mjs";

export const MAX_VERIFIER_FEE_ATOMS = 2_000_000n;
export const MAX_GRANT_AMOUNT_ATOMS = 30_000_000n;

export function buildUsdcTransferExecution({usdcToken, recipient, amount}) {
  return {
    target: normalizeAddress(usdcToken, "usdcToken"),
    value: "0x0",
    data: encodeErc20Transfer(recipient, amount),
  };
}

export function prepareVerifierX402Relay({
  chainId,
  usdcToken,
  venicePaymaster,
  feeAmount,
  permissionContext,
  destinationUrl,
  quoteContext,
}) {
  const amount = assertWithinCap(feeAmount, MAX_VERIFIER_FEE_ATOMS, "feeAmount");
  const recipient = normalizeAddress(venicePaymaster, "venicePaymaster");
  const execution = buildUsdcTransferExecution({usdcToken, recipient, amount});
  const relayParams = buildOneShot7710Params({
    chainId,
    permissionContext,
    executions: [execution],
    destinationUrl,
    context: quoteContext,
  });

  return {
    kind: "VERIFIER_X402_PAYMENT",
    endpoint: ONESHOT_RELAYER_RPC_URL,
    execution,
    transfer: decodeErc20Transfer(execution.data),
    request: buildSend7710Request(relayParams),
    logs: [
      "[A2A] VerifierAgent selected for Venice/x402 fee payment.",
      `[x402] Preparing USDC transfer: recipient=${recipient}, amount=${amount.toString()} atoms.`,
      `[1Shot] Drafted relayer_send7710Transaction: transactions[0].executions[0].target=${execution.target}.`,
    ],
  };
}

export function prepareTreasurerGrantRelay({
  chainId,
  usdcToken,
  requester,
  grantAmount,
  permissionContext,
  destinationUrl,
  quoteContext,
}) {
  const amount = assertWithinCap(grantAmount, MAX_GRANT_AMOUNT_ATOMS, "grantAmount");
  const recipient = normalizeAddress(requester, "requester");
  const execution = buildUsdcTransferExecution({usdcToken, recipient, amount});
  const relayParams = buildOneShot7710Params({
    chainId,
    permissionContext,
    executions: [execution],
    destinationUrl,
    context: quoteContext,
  });

  return {
    kind: "TREASURER_GRANT_PAYOUT",
    endpoint: ONESHOT_RELAYER_RPC_URL,
    execution,
    transfer: decodeErc20Transfer(execution.data),
    request: buildSend7710Request(relayParams),
    logs: [
      "[A2A] TreasurerAgent selected for approved grant payout.",
      `[TREASURER] Preparing USDC transfer: recipient=${recipient}, amount=${amount.toString()} atoms.`,
      `[1Shot] Drafted relayer_send7710Transaction: transactions[0].executions[0].target=${execution.target}.`,
    ],
  };
}

function assertWithinCap(value, cap, label) {
  const amount = assertPositiveAmount(value, label);

  if (amount > cap) {
    throw new RangeError(`${label} exceeds cap ${cap.toString()}`);
  }

  return amount;
}
