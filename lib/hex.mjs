export function normalizeAddress(value, label = "address") {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new TypeError(`${label} must be a 20-byte hex address`);
  }

  return value.toLowerCase();
}

export function normalizeHexData(value, label = "data") {
  if (typeof value !== "string" || !/^0x([0-9a-fA-F]{2})*$/.test(value)) {
    throw new TypeError(`${label} must be 0x-prefixed byte data`);
  }

  return value.toLowerCase();
}

export function normalizeAmount(value, label = "amount") {
  let amount;

  if (typeof value === "bigint") {
    amount = value;
  } else if (typeof value === "number" && Number.isSafeInteger(value)) {
    amount = BigInt(value);
  } else if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    amount = BigInt(value);
  } else if (typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value)) {
    amount = BigInt(value);
  } else {
    throw new TypeError(`${label} must be a non-negative integer amount or hex quantity`);
  }

  if (amount < 0n) {
    throw new RangeError(`${label} must be non-negative`);
  }

  return amount;
}

export function assertPositiveAmount(value, label = "amount") {
  const amount = normalizeAmount(value, label);

  if (amount === 0n) {
    throw new RangeError(`${label} must be greater than zero`);
  }

  return amount;
}

export function encodeUint256(value, label = "uint256") {
  const amount = normalizeAmount(value, label);

  if (amount > (1n << 256n) - 1n) {
    throw new RangeError(`${label} exceeds uint256`);
  }

  return amount.toString(16).padStart(64, "0");
}

export function toRpcQuantity(value, label = "quantity") {
  const amount = normalizeAmount(value, label);
  return `0x${amount.toString(16)}`;
}
