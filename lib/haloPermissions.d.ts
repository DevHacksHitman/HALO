export const BASE_SEPOLIA_CHAIN_ID: 84532;
export const BASE_SEPOLIA_CHAIN_ID_HEX: "0x14a34";
export const BASE_SEPOLIA_USDC_ADDRESS: `0x${string}`;
export const HALO_PERMISSION_TYPE: "erc20-token-periodic";
export const USDC_DECIMALS: 6;
export const MONTH_SECONDS: number;
export const DEFAULT_MONTHLY_CAP_USDC: "100";
export const DEFAULT_PERMISSION_EXPIRY_SECONDS: number;

export type HaloPermissionRequest = {
  chainId: number;
  from: `0x${string}`;
  to: `0x${string}`;
  expiry: number;
  permission: {
    type: "erc20-token-periodic";
    isAdjustmentAllowed: true;
    data: {
      tokenAddress: `0x${string}`;
      periodAmount: bigint;
      periodDuration: number;
      justification: string;
    };
  };
};

export type SerializableHaloPermissionRequest = Omit<HaloPermissionRequest, "permission"> & {
  permission: Omit<HaloPermissionRequest["permission"], "data"> & {
    data: Omit<HaloPermissionRequest["permission"]["data"], "periodAmount"> & {
      periodAmount: `0x${string}`;
    };
  };
};

export function isHexAddress(value: unknown): value is `0x${string}`;
export function assertHexAddress(value: unknown, label: string): asserts value is `0x${string}`;
export function parseDecimalToAtoms(value: string | number, decimals?: number): bigint;
export function toHexQuantity(value: bigint | number | string): `0x${string}`;
export function formatShortAddress(address: string): string;
export function createHaloPermissionRequest(options?: {
  donorAddress?: string;
  sessionAccount?: string;
  usdcToken?: string;
  chainId?: number;
  monthlyCapUsdc?: string;
  periodSeconds?: number;
  nowSeconds?: number;
  expirySeconds?: number;
}): HaloPermissionRequest;
export function serializePermissionRequest(
  request: HaloPermissionRequest,
): SerializableHaloPermissionRequest;
export function createSerializableHaloPermissionRequest(options?: Parameters<typeof createHaloPermissionRequest>[0]): SerializableHaloPermissionRequest;
