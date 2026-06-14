import {
  BASE_SEPOLIA_CHAIN_ID,
  getHaloChainProfile,
} from "./chainProfiles.mjs";
import {normalizeAddress} from "./hex.mjs";

export {BASE_SEPOLIA_CHAIN_ID};
export const BASE_SEPOLIA_CHAIN_NAME = "Base Sepolia";

const REQUIRED_ENFORCER_KEYS = [
  "HALO_ALLOWED_TARGET_ENFORCER",
  "HALO_ERC20_TRANSFER_RECIPIENT_ENFORCER",
  "HALO_ERC20_SPEND_LIMIT_ENFORCER",
];

export function createBaseSepoliaDeployConfig(env = process.env) {
  return createHaloDeployConfig({env, chainProfile: "base-sepolia"});
}

export function createHaloDeployConfig({env = process.env, chainProfile = env.HALO_CHAIN_PROFILE} = {}) {
  const profile = getHaloChainProfile(chainProfile);
  const rpcUrl = requireNonEmptyString(env[profile.rpcUrlEnvVar], profile.rpcUrlEnvVar);
  const privateKey = normalizePrivateKey(env[profile.privateKeyEnvVar], profile.privateKeyEnvVar);
  const usdcToken = normalizeAddress(
    env.HALO_USDC_ADDRESS ||
      (profile.mainnet
        ? env.HALO_BASE_MAINNET_USDC_ADDRESS || profile.usdcAddress
        : env.HALO_BASE_SEPOLIA_USDC_ADDRESS || env.NEXT_PUBLIC_HALO_USDC_ADDRESS || profile.usdcAddress),
    profile.mainnet ? "HALO_BASE_MAINNET_USDC_ADDRESS" : "HALO_BASE_SEPOLIA_USDC_ADDRESS",
  );
  const venicePaymaster = normalizeAddress(env.HALO_VENICE_PAYMASTER_ADDRESS, "HALO_VENICE_PAYMASTER_ADDRESS");
  const allowedTargetEnforcer = normalizeAddress(
    env.HALO_ALLOWED_TARGET_ENFORCER,
    "HALO_ALLOWED_TARGET_ENFORCER",
  );
  const erc20TransferRecipientEnforcer = normalizeAddress(
    env.HALO_ERC20_TRANSFER_RECIPIENT_ENFORCER,
    "HALO_ERC20_TRANSFER_RECIPIENT_ENFORCER",
  );
  const erc20SpendLimitEnforcer = normalizeAddress(
    env.HALO_ERC20_SPEND_LIMIT_ENFORCER,
    "HALO_ERC20_SPEND_LIMIT_ENFORCER",
  );
  const verifierAgent = optionalAddress(env.HALO_VERIFIER_AGENT_ADDRESS, "HALO_VERIFIER_AGENT_ADDRESS");
  const treasurerAgent = optionalAddress(env.HALO_TREASURER_AGENT_ADDRESS, "HALO_TREASURER_AGENT_ADDRESS");

  return {
    chainProfile: profile.id,
    chainId: profile.chainId,
    chainName: profile.label,
    rpcUrlEnvVar: profile.rpcUrlEnvVar,
    privateKeyEnvVar: profile.privateKeyEnvVar,
    rpcUrl,
    privateKey,
    usdcToken,
    venicePaymaster,
    verifierAgent,
    treasurerAgent,
    allowedTargetEnforcer,
    erc20TransferRecipientEnforcer,
    erc20SpendLimitEnforcer,
    deployVerifierHelper: !verifierAgent,
    deployTreasurerHelper: !treasurerAgent,
  };
}

export function redactDeployConfig(config) {
  return {
    ...config,
    privateKey: "<redacted>",
    rpcUrl: "<configured>",
  };
}

export function buildForgeDeploymentPlan(config) {
  const verifierAgent = config.verifierAgent || "$HALO_VERIFIER_AGENT_ADDRESS";
  const treasurerAgent = config.treasurerAgent || "$HALO_TREASURER_AGENT_ADDRESS";
  const commands = [];

  if (config.deployVerifierHelper) {
    commands.push(
      `forge create src/HaloVerifier.sol:HaloVerifier --rpc-url "$${config.rpcUrlEnvVar}" --private-key "$${config.privateKeyEnvVar}"`,
    );
  }

  if (config.deployTreasurerHelper) {
    commands.push(
      `forge create src/HaloTreasurer.sol:HaloTreasurer --rpc-url "$${config.rpcUrlEnvVar}" --private-key "$${config.privateKeyEnvVar}"`,
    );
  }

  commands.push(
    [
      "forge create src/HaloAlmoner.sol:HaloAlmoner",
      `--rpc-url "$${config.rpcUrlEnvVar}"`,
      `--private-key "$${config.privateKeyEnvVar}"`,
      "--constructor-args",
      config.usdcToken,
      config.venicePaymaster,
      verifierAgent,
      treasurerAgent,
      config.allowedTargetEnforcer,
      config.erc20TransferRecipientEnforcer,
      config.erc20SpendLimitEnforcer,
    ].join(" "),
  );

  return {
    chainId: config.chainId,
    chainName: config.chainName,
    commands,
  };
}

export function missingBaseSepoliaDeployKeys(env = process.env) {
  return missingHaloDeployKeys({env, chainProfile: "base-sepolia"});
}

export function missingHaloDeployKeys({env = process.env, chainProfile = env.HALO_CHAIN_PROFILE} = {}) {
  const profile = getHaloChainProfile(chainProfile);
  const missing = [];
  for (const key of [profile.rpcUrlEnvVar, profile.privateKeyEnvVar, "HALO_VENICE_PAYMASTER_ADDRESS"]) {
    if (!env[key]) {
      missing.push(key);
    }
  }

  for (const key of REQUIRED_ENFORCER_KEYS) {
    if (!env[key]) {
      missing.push(key);
    }
  }

  return missing;
}

function optionalAddress(value, label) {
  if (!value) {
    return "";
  }

  return normalizeAddress(value, label);
}

function normalizePrivateKey(value, label) {
  const privateKey = requireNonEmptyString(value, label);
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new TypeError(`${label} must be a 32-byte hex private key`);
  }

  return privateKey;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be configured`);
  }

  return value.trim();
}
