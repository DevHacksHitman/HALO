import {decodeErc20Transfer, encodeErc20Transfer} from "./erc20.mjs";
import {BASE_SEPOLIA_USDC_ADDRESS, USDC_DECIMALS, parseDecimalToAtoms} from "./haloPermissions.mjs";
import {assertPositiveAmount, normalizeAddress, normalizeAmount} from "./hex.mjs";
import {
  ONESHOT_RELAYER_RPC_URL,
  getOneShotCapabilities,
  getOneShotFeeData,
} from "./oneShot.mjs";

export const DEFAULT_ONESHOT_MOCK_FEE_USDC = "0.01";

export async function fetchOneShotFeePaymentPlan({
  chainId = 84532,
  token = process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || BASE_SEPOLIA_USDC_ADDRESS,
  endpoint = ONESHOT_RELAYER_RPC_URL,
  mockFeeUsdc = process.env.HALO_ONESHOT_ESTIMATE_MOCK_FEE_USDC || DEFAULT_ONESHOT_MOCK_FEE_USDC,
  fetchImpl,
} = {}) {
  const normalizedChainId = normalizeAmount(chainId, "chainId");
  const normalizedToken = normalizeAddress(token, "token");
  const capabilities = await getOneShotCapabilities([normalizedChainId], {
    endpoint,
    fetchImpl,
    id: 16,
  });
  const capability = selectCapability(capabilities, normalizedChainId);
  const targetAddress = normalizeAddress(capability.targetAddress, "capability.targetAddress");
  const feeCollector = normalizeAddress(capability.feeCollector, "capability.feeCollector");
  const tokenInfo = selectCapabilityToken(capability, normalizedToken);
  const decimals = parseTokenDecimals(tokenInfo.decimals);
  const feeData = await getOneShotFeeData(
    {chainId: normalizedChainId, token: normalizedToken},
    {endpoint, fetchImpl, id: 17},
  );

  const minFeeAtoms = parseFeeAtoms(feeData.minFee, decimals, "feeData.minFee");
  const mockFeeAtoms = maxBigInt(minFeeAtoms, parseDecimalToAtoms(mockFeeUsdc, decimals));
  const execution = buildErc20TransferExecution({
    token: normalizedToken,
    recipient: feeCollector,
    amount: mockFeeAtoms,
  });

  return {
    chainId: normalizedChainId.toString(),
    endpoint,
    token: normalizedToken,
    tokenSymbol: tokenInfo.symbol ?? "USDC",
    tokenDecimals: decimals,
    targetAddress,
    feeCollector,
    minFeeAtoms: minFeeAtoms.toString(),
    mockFeeAtoms: mockFeeAtoms.toString(),
    mockFeeUsdc,
    contextPresent: Boolean(feeData.context),
    requiredPaymentAmount: stringifyOptional(feeData.requiredPaymentAmount),
    execution,
    transfer: decodeErc20Transfer(execution.data),
  };
}

export function buildErc20TransferExecution({token, recipient, amount}) {
  return {
    target: normalizeAddress(token, "token"),
    value: "0x0",
    data: encodeErc20Transfer(recipient, assertPositiveAmount(amount, "amount")),
  };
}

export function selectCapability(capabilities, chainId) {
  const key = normalizeAmount(chainId, "chainId").toString();
  if (capabilities && typeof capabilities === "object" && !Array.isArray(capabilities)) {
    const byKey = capabilities[key] ?? capabilities.chains?.[key];
    if (byKey && typeof byKey === "object" && !Array.isArray(byKey)) {
      return byKey;
    }
  }

  if (Array.isArray(capabilities)) {
    const found = capabilities.find((capability) => String(capability?.chainId) === key);
    if (found && typeof found === "object") {
      return found;
    }
  }

  throw new Error(`1Shot capabilities did not include chain ${key}`);
}

export function selectCapabilityToken(capability, token) {
  const normalizedToken = normalizeAddress(token, "token");
  const tokens = Array.isArray(capability.tokens) ? capability.tokens : [];
  const found = tokens.find((candidate) => {
    if (typeof candidate === "string") {
      return normalizeAddress(candidate, "capability.token") === normalizedToken;
    }
    if (candidate && typeof candidate === "object") {
      const address = candidate.address ?? candidate.token ?? candidate.tokenAddress;
      return address && normalizeAddress(address, "capability.token.address") === normalizedToken;
    }
    return false;
  });

  if (!found) {
    throw new Error(`1Shot capabilities did not include token ${normalizedToken}`);
  }

  return typeof found === "string" ? {address: normalizedToken, decimals: USDC_DECIMALS} : found;
}

function parseTokenDecimals(value) {
  const decimals = Number(value ?? USDC_DECIMALS);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("token decimals must be an integer between 0 and 36");
  }
  return decimals;
}

function parseFeeAtoms(value, decimals, label) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${label} is required`);
  }

  return parseDecimalToAtoms(value, decimals);
}

function maxBigInt(left, right) {
  return left > right ? left : right;
}

function stringifyOptional(value) {
  return value === undefined || value === null ? null : String(value);
}
