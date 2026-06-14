import {decodeErc20Transfer, encodeErc20Transfer} from "./erc20.mjs";
import {USDC_DECIMALS, parseDecimalToAtoms} from "./haloPermissions.mjs";
import {assertPositiveAmount, normalizeAddress, normalizeAmount} from "./hex.mjs";
import {
  ONESHOT_RELAYER_RPC_URL,
  getOneShotCapabilities,
  getOneShotFeeData,
} from "./oneShot.mjs";
import {getHaloChainProfile} from "./chainProfiles.mjs";

export const HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC_ENV_VAR = "HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC";
export const HALO_ONESHOT_ESTIMATE_LEGACY_MOCK_FEE_USDC_ENV_VAR = "HALO_ONESHOT_ESTIMATE_MOCK_FEE_USDC";
export const DEFAULT_ONESHOT_INITIAL_FEE_USDC = "0.01";
export const DEFAULT_ONESHOT_MOCK_FEE_USDC = DEFAULT_ONESHOT_INITIAL_FEE_USDC;

export async function fetchOneShotFeePaymentPlan({
  chainProfile = process.env.HALO_CHAIN_PROFILE,
  chainId,
  token,
  endpoint,
  initialFeeUsdc = process.env[HALO_ONESHOT_ESTIMATE_INITIAL_FEE_USDC_ENV_VAR] ||
    process.env[HALO_ONESHOT_ESTIMATE_LEGACY_MOCK_FEE_USDC_ENV_VAR] ||
    DEFAULT_ONESHOT_INITIAL_FEE_USDC,
  mockFeeUsdc = initialFeeUsdc,
  fetchImpl,
} = {}) {
  const profile = getHaloChainProfile(chainProfile);
  const normalizedChainId = normalizeAmount(chainId ?? profile.chainId, "chainId");
  const selectedToken = token ??
    process.env.HALO_USDC_ADDRESS ??
    (profile.mainnet ? profile.usdcAddress : process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS ?? profile.usdcAddress);
  const normalizedToken = normalizeAddress(selectedToken, "token");
  const selectedEndpoint = endpoint ?? profile.relayerRpcUrl ?? process.env.ONESHOT_RELAYER_RPC_URL ?? ONESHOT_RELAYER_RPC_URL;
  const capabilities = await getOneShotCapabilities([normalizedChainId], {
    endpoint: selectedEndpoint,
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
    {endpoint: selectedEndpoint, fetchImpl, id: 17},
  );

  const minFeeAtoms = parseFeeAtoms(feeData.minFee, decimals, "feeData.minFee");
  const initialFeeAtoms = maxBigInt(minFeeAtoms, parseDecimalToAtoms(mockFeeUsdc, decimals));
  const execution = buildErc20TransferExecution({
    token: normalizedToken,
    recipient: feeCollector,
    amount: initialFeeAtoms,
  });

  return {
    chainId: normalizedChainId.toString(),
    chainProfile: profile.id,
    chainLabel: profile.label,
    endpoint: selectedEndpoint,
    token: normalizedToken,
    tokenSymbol: tokenInfo.symbol ?? "USDC",
    tokenDecimals: decimals,
    targetAddress,
    feeCollector,
    minFeeAtoms: minFeeAtoms.toString(),
    initialFeeAtoms: initialFeeAtoms.toString(),
    initialFeeUsdc: mockFeeUsdc,
    mockFeeAtoms: initialFeeAtoms.toString(),
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

export function adjustOneShotFeePaymentPlanAmount(plan, amount) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new TypeError("1Shot fee payment plan is required before adjustment");
  }

  const adjustedAmount = assertPositiveAmount(amount, "requiredPaymentAmount");
  const token = normalizeAddress(plan.token, "plan.token");
  const feeCollector = normalizeAddress(plan.feeCollector, "plan.feeCollector");
  const execution = buildErc20TransferExecution({
    token,
    recipient: feeCollector,
    amount: adjustedAmount,
  });

  return {
    ...plan,
    token,
    feeCollector,
    mockFeeAtoms: adjustedAmount.toString(),
    mockFeeUsdc: formatAtomsAsDecimal(adjustedAmount, parseTokenDecimals(plan.tokenDecimals)),
    adjustedToRequiredPaymentAmount: true,
    execution,
    transfer: decodeErc20Transfer(execution.data),
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

function formatAtomsAsDecimal(value, decimals) {
  const atoms = normalizeAmount(value, "amount");
  const scale = 10n ** BigInt(decimals);
  const whole = atoms / scale;
  const fractional = atoms % scale;
  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractional.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}
