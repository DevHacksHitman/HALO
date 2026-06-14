import {ONESHOT_RELAYER_MAINNET_RPC_URL, ONESHOT_RELAYER_TESTNET_RPC_URL} from "./oneShot.mjs";
import {normalizeAddress} from "./hex.mjs";

export const HALO_CHAIN_PROFILE_ENV_VAR = "HALO_CHAIN_PROFILE";
export const HALO_MAINNET_DEMO_ARMED_ENV_VAR = "HALO_MAINNET_DEMO_ARMED";
export const HALO_MAINNET_DEMO_GRANT_USDC_ENV_VAR = "HALO_MAINNET_DEMO_GRANT_USDC";
export const HALO_MAINNET_MAX_RELAYER_FEE_USDC_ENV_VAR = "HALO_MAINNET_MAX_RELAYER_FEE_USDC";

export const HALO_CHAIN_PROFILES = Object.freeze({
  BASE_SEPOLIA: "base-sepolia",
  BASE_MAINNET: "base-mainnet",
});

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_CHAIN_ID_HEX = "0x14a34";
export const BASE_SEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_MAINNET_CHAIN_ID_HEX = "0x2105";
export const BASE_MAINNET_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const CHAIN_PROFILE_REGISTRY = Object.freeze({
  [HALO_CHAIN_PROFILES.BASE_SEPOLIA]: Object.freeze({
    id: HALO_CHAIN_PROFILES.BASE_SEPOLIA,
    label: "Base Sepolia",
    chainId: BASE_SEPOLIA_CHAIN_ID,
    chainIdHex: BASE_SEPOLIA_CHAIN_ID_HEX,
    viemChainExport: "baseSepolia",
    usdcAddress: BASE_SEPOLIA_USDC_ADDRESS,
    relayerRpcUrl: ONESHOT_RELAYER_TESTNET_RPC_URL,
    rpcUrlEnvVar: "BASE_SEPOLIA_RPC_URL",
    privateKeyEnvVar: "BASE_SEPOLIA_PRIVATE_KEY",
    blockExplorerUrl: "https://sepolia.basescan.org",
    defaultRpcUrl: "https://sepolia.base.org",
    mainnet: false,
  }),
  [HALO_CHAIN_PROFILES.BASE_MAINNET]: Object.freeze({
    id: HALO_CHAIN_PROFILES.BASE_MAINNET,
    label: "Base mainnet",
    chainId: BASE_MAINNET_CHAIN_ID,
    chainIdHex: BASE_MAINNET_CHAIN_ID_HEX,
    viemChainExport: "base",
    usdcAddress: BASE_MAINNET_USDC_ADDRESS,
    relayerRpcUrl: ONESHOT_RELAYER_MAINNET_RPC_URL,
    rpcUrlEnvVar: "BASE_MAINNET_RPC_URL",
    privateKeyEnvVar: "BASE_MAINNET_PRIVATE_KEY",
    blockExplorerUrl: "https://basescan.org",
    defaultRpcUrl: "https://mainnet.base.org",
    mainnet: true,
  }),
});

export function getHaloChainProfile(profileName = process.env.HALO_CHAIN_PROFILE) {
  const profileId = normalizeProfileId(profileName);
  return CHAIN_PROFILE_REGISTRY[profileId];
}

export function getHaloChainProfileByChainId(chainId) {
  const normalized = Number(chainId);
  const profile = Object.values(CHAIN_PROFILE_REGISTRY).find((candidate) => candidate.chainId === normalized);
  if (!profile) {
    throw new TypeError(`unsupported Halo chainId: ${String(chainId)}`);
  }

  return profile;
}

export function resolveHaloChainProfile({
  profileName = process.env.HALO_CHAIN_PROFILE,
  chainId,
  endpoint,
} = {}) {
  if (chainId !== undefined && chainId !== null && chainId !== "") {
    return getHaloChainProfileByChainId(chainId);
  }

  if (endpoint) {
    const profile = Object.values(CHAIN_PROFILE_REGISTRY).find((candidate) => candidate.relayerRpcUrl === endpoint);
    if (profile) {
      return profile;
    }
  }

  return getHaloChainProfile(profileName);
}

export function normalizeProfileId(profileName = "") {
  const raw = String(profileName || HALO_CHAIN_PROFILES.BASE_SEPOLIA).trim().toLowerCase();
  const aliases = {
    "base-sepolia": HALO_CHAIN_PROFILES.BASE_SEPOLIA,
    basesepolia: HALO_CHAIN_PROFILES.BASE_SEPOLIA,
    sepolia: HALO_CHAIN_PROFILES.BASE_SEPOLIA,
    "base-mainnet": HALO_CHAIN_PROFILES.BASE_MAINNET,
    basemainnet: HALO_CHAIN_PROFILES.BASE_MAINNET,
    base: HALO_CHAIN_PROFILES.BASE_MAINNET,
    mainnet: HALO_CHAIN_PROFILES.BASE_MAINNET,
  };
  const profileId = aliases[raw];
  if (!profileId || !CHAIN_PROFILE_REGISTRY[profileId]) {
    throw new TypeError(
      `${HALO_CHAIN_PROFILE_ENV_VAR} must be one of: ${Object.keys(CHAIN_PROFILE_REGISTRY).join(", ")}`,
    );
  }

  return profileId;
}

export function isMainnetProfile(profile) {
  return Boolean(profile?.mainnet);
}

export function validateMainnetLiveSendReadiness({
  profile,
  liveSendEnabled = process.env.HALO_ONESHOT_LIVE === "1",
  mainnetArmed = process.env.HALO_MAINNET_DEMO_ARMED === "1",
  webhookUrlReady = false,
  estimateSucceeded = false,
  plannedGrantAmountAtoms,
  plannedRelayerFeeAtoms,
  maxGrantUsdc = process.env.HALO_MAINNET_DEMO_GRANT_USDC || "5",
  maxRelayerFeeUsdc = process.env.HALO_MAINNET_MAX_RELAYER_FEE_USDC || "0.50",
} = {}) {
  const issues = [];
  const activeProfile = profile ?? getHaloChainProfile();

  if (!activeProfile.mainnet) {
    return {
      profile: activeProfile,
      mainnet: false,
      status: "NOT_MAINNET",
      armed: false,
      maxGrantAtoms: decimalUsdcToAtoms(maxGrantUsdc),
      maxRelayerFeeAtoms: decimalUsdcToAtoms(maxRelayerFeeUsdc),
      issues,
      ready: true,
    };
  }

  if (!liveSendEnabled) {
    issues.push("HALO_ONESHOT_LIVE=1 is required before a Base mainnet send");
  }
  if (!mainnetArmed) {
    issues.push(`${HALO_MAINNET_DEMO_ARMED_ENV_VAR}=1 is required before a Base mainnet send`);
  }
  if (!webhookUrlReady) {
    issues.push("HALO_ONESHOT_WEBHOOK_URL must be a real public HTTPS callback before a Base mainnet send");
  }
  if (!estimateSucceeded) {
    issues.push("a successful 1Shot estimate is required before a Base mainnet send");
  }

  const maxGrantAtoms = decimalUsdcToAtoms(maxGrantUsdc);
  const maxRelayerFeeAtoms = decimalUsdcToAtoms(maxRelayerFeeUsdc);
  const grantAtoms = plannedGrantAmountAtoms === undefined || plannedGrantAmountAtoms === null
    ? null
    : BigInt(plannedGrantAmountAtoms);
  const feeAtoms = plannedRelayerFeeAtoms === undefined || plannedRelayerFeeAtoms === null
    ? null
    : BigInt(plannedRelayerFeeAtoms);

  if (grantAtoms !== null && grantAtoms > maxGrantAtoms) {
    issues.push(`mainnet demo grant ${grantAtoms.toString()} atoms exceeds cap ${maxGrantAtoms.toString()}`);
  }
  if (feeAtoms !== null && feeAtoms > maxRelayerFeeAtoms) {
    issues.push(`mainnet relayer fee ${feeAtoms.toString()} atoms exceeds cap ${maxRelayerFeeAtoms.toString()}`);
  }

  return {
    profile: activeProfile,
    mainnet: true,
    status: issues.length > 0 ? "NO_GO_MAINNET_BLOCKED" : "CONDITIONAL_GO_MAINNET_ARMED",
    armed: mainnetArmed,
    liveSendEnabled,
    webhookUrlReady,
    estimateSucceeded,
    plannedGrantAmountAtoms: grantAtoms?.toString() ?? null,
    plannedRelayerFeeAtoms: feeAtoms?.toString() ?? null,
    maxGrantAtoms: maxGrantAtoms.toString(),
    maxRelayerFeeAtoms: maxRelayerFeeAtoms.toString(),
    issues,
    ready: issues.length === 0,
  };
}

export function decimalUsdcToAtoms(value, label = "USDC amount") {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError(`${label} must be a string or number`);
  }

  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new TypeError(`${label} must be a non-negative decimal`);
  }

  const [wholePart, fractionalPart = ""] = text.split(".");
  if (fractionalPart.length > 6) {
    throw new RangeError(`${label} has more than 6 decimals`);
  }

  return BigInt(wholePart) * 1_000_000n + BigInt(fractionalPart.padEnd(6, "0") || "0");
}

export function normalizeProfileTokenAddress(profile, token = profile?.usdcAddress) {
  return normalizeAddress(token, `${profile?.id ?? "profile"}.usdcAddress`);
}
