import {assertPositiveAmount, encodeUint256, normalizeAddress, normalizeHexData} from "./hex.mjs";

export const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

export function encodeErc20Transfer(recipient, amount) {
  const normalizedRecipient = normalizeAddress(recipient, "recipient");
  const positiveAmount = assertPositiveAmount(amount, "amount");
  const encodedRecipient = normalizedRecipient.slice(2).padStart(64, "0");
  const encodedAmount = encodeUint256(positiveAmount, "amount");

  return `${ERC20_TRANSFER_SELECTOR}${encodedRecipient}${encodedAmount}`;
}

export function decodeErc20Transfer(data) {
  const normalizedData = normalizeHexData(data, "erc20 transfer data");

  if (!normalizedData.startsWith(ERC20_TRANSFER_SELECTOR)) {
    throw new TypeError("erc20 transfer data has the wrong selector");
  }

  if (normalizedData.length !== 138) {
    throw new TypeError("erc20 transfer data must encode exactly transfer(address,uint256)");
  }

  const recipient = `0x${normalizedData.slice(34, 74)}`;
  const amount = BigInt(`0x${normalizedData.slice(74)}`);

  return {recipient, amount: amount.toString()};
}

