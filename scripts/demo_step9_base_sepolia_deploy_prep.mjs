import {
  buildForgeDeploymentPlan,
  createBaseSepoliaDeployConfig,
  missingBaseSepoliaDeployKeys,
  redactDeployConfig,
} from "../lib/deployConfig.mjs";

const demoEnv = {
  BASE_SEPOLIA_RPC_URL: "https://base-sepolia.example",
  BASE_SEPOLIA_PRIVATE_KEY:
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  HALO_VENICE_PAYMASTER_ADDRESS: "0xcccccccccccccccccccccccccccccccccccccccc",
  HALO_ALLOWED_TARGET_ENFORCER: "0x1111111111111111111111111111111111111111",
  HALO_ERC20_TRANSFER_RECIPIENT_ENFORCER:
    "0x2222222222222222222222222222222222222222",
  HALO_ERC20_SPEND_LIMIT_ENFORCER: "0x3333333333333333333333333333333333333333",
};

const config = createBaseSepoliaDeployConfig(demoEnv);
const plan = buildForgeDeploymentPlan(config);

console.log("[DEPLOY] Target chain=Base Sepolia");
console.log("[DEPLOY] chainId=" + config.chainId);
console.log("[DEPLOY] USDC=" + config.usdcToken);

console.log("[CONFIG] Redacted deploy config:");
console.log(JSON.stringify(redactDeployConfig(config), null, 2));

console.log("");
console.log("[CHECK] Required live env keys:");
for (const key of [
  "BASE_SEPOLIA_RPC_URL",
  "BASE_SEPOLIA_PRIVATE_KEY",
  "HALO_VENICE_PAYMASTER_ADDRESS",
  "HALO_ALLOWED_TARGET_ENFORCER",
  "HALO_ERC20_TRANSFER_RECIPIENT_ENFORCER",
  "HALO_ERC20_SPEND_LIMIT_ENFORCER",
]) {
  console.log("- " + key);
}

console.log("");
console.log("[CHECK] Missing keys in current shell:");
const missing = missingBaseSepoliaDeployKeys(process.env);
console.log(missing.length ? missing.join(", ") : "none");

console.log("");
console.log("[FORGE] Deployment command plan:");
for (const command of plan.commands) {
  console.log("$ " + command);
}

console.log("");
console.log("[NEXT] actual broadcast command: scripts/deploy_base_sepolia.sh");
