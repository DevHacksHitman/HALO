import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  BASE_SEPOLIA_CHAIN_ID,
  buildForgeDeploymentPlan,
  createHaloDeployConfig,
  createBaseSepoliaDeployConfig,
  missingBaseSepoliaDeployKeys,
  missingHaloDeployKeys,
  redactDeployConfig,
} from "../../lib/deployConfig.mjs";

const baseEnv = {
  BASE_SEPOLIA_RPC_URL: "https://base-sepolia.example",
  BASE_SEPOLIA_PRIVATE_KEY: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  HALO_VENICE_PAYMASTER_ADDRESS: "0xcccccccccccccccccccccccccccccccccccccccc",
  HALO_ALLOWED_TARGET_ENFORCER: "0x1111111111111111111111111111111111111111",
  HALO_ERC20_TRANSFER_RECIPIENT_ENFORCER: "0x2222222222222222222222222222222222222222",
  HALO_ERC20_SPEND_LIMIT_ENFORCER: "0x3333333333333333333333333333333333333333",
};

describe("Base Sepolia deployment config", () => {
  it("validates Base Sepolia deployment inputs without leaking the private key", () => {
    const config = createBaseSepoliaDeployConfig(baseEnv);
    const redacted = redactDeployConfig(config);

    assert.equal(config.chainId, BASE_SEPOLIA_CHAIN_ID);
    assert.equal(config.deployVerifierHelper, true);
    assert.equal(config.deployTreasurerHelper, true);
    assert.equal(redacted.privateKey, "<redacted>");
    assert.equal(redacted.rpcUrl, "<configured>");
  });

  it("builds deploy commands for helper contracts and HaloAlmoner", () => {
    const config = createBaseSepoliaDeployConfig(baseEnv);
    const plan = buildForgeDeploymentPlan(config);

    assert.equal(plan.chainName, "Base Sepolia");
    assert.equal(plan.commands.length, 3);
    assert.match(plan.commands[0], /HaloVerifier/);
    assert.match(plan.commands[1], /HaloTreasurer/);
    assert.match(plan.commands[2], /HaloAlmoner/);
    assert.match(plan.commands[2], /0x036cbd53842c5426634e7929541ec2318f3dcf7e/);
    assert.doesNotMatch(plan.commands.join("\n"), /aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/);
  });

  it("builds a Base mainnet deployment plan from profile-specific env vars", () => {
    const config = createHaloDeployConfig({
      chainProfile: "base-mainnet",
      env: {
        ...baseEnv,
        BASE_MAINNET_RPC_URL: "https://base-mainnet.example",
        BASE_MAINNET_PRIVATE_KEY: baseEnv.BASE_SEPOLIA_PRIVATE_KEY,
      },
    });
    const plan = buildForgeDeploymentPlan(config);

    assert.equal(config.chainProfile, "base-mainnet");
    assert.equal(config.chainId, 8453);
    assert.equal(config.chainName, "Base mainnet");
    assert.match(plan.commands[0], /\$BASE_MAINNET_RPC_URL/);
    assert.match(plan.commands[0], /\$BASE_MAINNET_PRIVATE_KEY/);
    assert.equal(missingHaloDeployKeys({chainProfile: "base-mainnet", env: baseEnv}).includes("BASE_MAINNET_RPC_URL"), true);
  });

  it("uses preconfigured agent addresses when helpers are already deployed", () => {
    const config = createBaseSepoliaDeployConfig({
      ...baseEnv,
      HALO_VERIFIER_AGENT_ADDRESS: "0x4444444444444444444444444444444444444444",
      HALO_TREASURER_AGENT_ADDRESS: "0x5555555555555555555555555555555555555555",
    });
    const plan = buildForgeDeploymentPlan(config);

    assert.equal(config.deployVerifierHelper, false);
    assert.equal(config.deployTreasurerHelper, false);
    assert.equal(plan.commands.length, 1);
    assert.match(plan.commands[0], /0x4444444444444444444444444444444444444444/);
    assert.match(plan.commands[0], /0x5555555555555555555555555555555555555555/);
  });

  it("reports missing deployment keys and rejects malformed private keys", () => {
    assert.deepEqual(missingBaseSepoliaDeployKeys({}), [
      "BASE_SEPOLIA_RPC_URL",
      "BASE_SEPOLIA_PRIVATE_KEY",
      "HALO_VENICE_PAYMASTER_ADDRESS",
      "HALO_ALLOWED_TARGET_ENFORCER",
      "HALO_ERC20_TRANSFER_RECIPIENT_ENFORCER",
      "HALO_ERC20_SPEND_LIMIT_ENFORCER",
    ]);

    assert.throws(
      () =>
        createBaseSepoliaDeployConfig({
          ...baseEnv,
          BASE_SEPOLIA_PRIVATE_KEY: "0x1234",
        }),
      /32-byte hex private key/,
    );
  });
});
