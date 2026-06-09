export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_CHAIN_ID_HEX = "0x14a34";
export const BASE_SEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const HALO_PERMISSION_TYPE = "erc20-token-periodic";
export const USDC_DECIMALS = 6;
export const MONTH_SECONDS = 30 * 24 * 60 * 60;
export const DEFAULT_MONTHLY_CAP_USDC = "100";
export const DEFAULT_PERMISSION_EXPIRY_SECONDS = MONTH_SECONDS;

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function isHexAddress(value) {
  return typeof value === "string" && ADDRESS_PATTERN.test(value);
}

export function assertHexAddress(value, label) {
  if (!isHexAddress(value)) {
    throw new TypeError(`${label} must be a 20-byte hex address`);
  }
}

export function parseDecimalToAtoms(value, decimals = USDC_DECIMALS) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError("amount must be a string or number");
  }

  const normalized = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new TypeError("amount must be a non-negative decimal");
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  if (fractionalPart.length > decimals) {
    throw new RangeError(`amount has more than ${decimals} decimals`);
  }

  const wholeAtoms = BigInt(wholePart) * 10n ** BigInt(decimals);
  const fractionalAtoms = BigInt(fractionalPart.padEnd(decimals, "0") || "0");
  return wholeAtoms + fractionalAtoms;
}

export function toHexQuantity(value) {
  const amount = typeof value === "bigint" ? value : BigInt(value);
  if (amount < 0n) {
    throw new RangeError("quantity cannot be negative");
  }
  return `0x${amount.toString(16)}`;
}

export function formatShortAddress(address) {
  if (!isHexAddress(address)) {
    return "not configured";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function createHaloPermissionRequest({
  donorAddress = "",
  sessionAccount = "",
  usdcToken = BASE_SEPOLIA_USDC_ADDRESS,
  chainId = BASE_SEPOLIA_CHAIN_ID,
  monthlyCapUsdc = DEFAULT_MONTHLY_CAP_USDC,
  periodSeconds = MONTH_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
  expirySeconds = DEFAULT_PERMISSION_EXPIRY_SECONDS,
} = {}) {
  assertHexAddress(donorAddress, "donorAddress");
  assertHexAddress(sessionAccount, "sessionAccount");
  assertHexAddress(usdcToken, "usdcToken");

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new TypeError("chainId must be a positive integer");
  }

  if (!Number.isInteger(periodSeconds) || periodSeconds <= 0) {
    throw new TypeError("periodSeconds must be a positive integer");
  }

  if (!Number.isInteger(nowSeconds) || nowSeconds <= 0) {
    throw new TypeError("nowSeconds must be a positive integer");
  }

  if (!Number.isInteger(expirySeconds) || expirySeconds <= 0) {
    throw new TypeError("expirySeconds must be a positive integer");
  }

  return {
    chainId,
    from: donorAddress,
    to: sessionAccount,
    expiry: nowSeconds + expirySeconds,
    permission: {
      type: HALO_PERMISSION_TYPE,
      isAdjustmentAllowed: true,
      data: {
        tokenAddress: usdcToken,
        periodAmount: parseDecimalToAtoms(monthlyCapUsdc),
        periodDuration: periodSeconds,
        justification:
          "Halo donor allowance for verifier API fees and approved USDC mutual-aid payouts.",
      },
    },
  };
}

export function serializePermissionRequest(request) {
  return {
    ...request,
    permission: {
      ...request.permission,
      data: {
        ...request.permission.data,
        periodAmount: toHexQuantity(request.permission.data.periodAmount),
      },
    },
  };
}

export function createSerializableHaloPermissionRequest(options) {
  return serializePermissionRequest(createHaloPermissionRequest(options));
}
