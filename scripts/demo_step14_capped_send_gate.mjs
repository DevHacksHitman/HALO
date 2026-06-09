import {encodeDelegations} from "@metamask/smart-accounts-kit/utils";

import {
  buildOneShotSendGate,
  formatOneShotSendGateLogs,
  runOneShotSendAfterGate,
} from "../lib/oneShotSendGate.mjs";

const envGate = buildOneShotSendGate();
printGate("CURRENT_ENV_SEND_GATE", envGate);

if (envGate.readyForNetworkSend) {
  console.log("");
  console.log("[1Shot] Running capped testnet send now...");
  const result = await runOneShotSendAfterGate(envGate);
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("");
  console.log("[1Shot] Network send not called. Real context, estimate receipt, and HALO_ONESHOT_LIVE=1 are required.");
}

if (!envGate.realContextPresent || !envGate.estimateResultPresent) {
  const fixtureGate = buildOneShotSendGate({
    permissionContext: buildFixturePermissionContext(),
    estimateResult: {gas: "0x1234", fee: "0x10", fixture: true},
    liveSendEnabled: false,
  });
  printGate("FIXTURE_DRY_RUN_SEND_GATE", fixtureGate);
}

console.log("");
console.log("[NEXT] After a real taskId returns, wire webhook/status confirmation for the live testnet send.");

function printGate(label, gate) {
  console.log("");
  console.log(`[HALO] ${label}`);
  for (const line of formatOneShotSendGateLogs(gate)) {
    console.log(line);
  }
  console.log(
    JSON.stringify(
      {
        step: gate.step,
        status: gate.status,
        chainId: gate.chainId,
        endpoint: gate.endpoint,
        realContextPresent: gate.realContextPresent,
        estimateResultPresent: gate.estimateResultPresent,
        liveSendEnabled: gate.liveSendEnabled,
        readyForNetworkSend: gate.readyForNetworkSend,
        grantAmountAtoms: gate.grantAmountAtoms,
        grantCapAtoms: gate.grantCapAtoms,
        issues: gate.issues,
        sendMethod: gate.sendRequest?.method ?? null,
      },
      null,
      2,
    ),
  );
}

function buildFixturePermissionContext() {
  return encodeDelegations([
    {
      delegate: "0x1111111111111111111111111111111111111111",
      delegator: "0x2222222222222222222222222222222222222222",
      authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
      caveats: [
        {
          enforcer: "0x3333333333333333333333333333333333333333",
          terms: "0x",
          args: "0x",
        },
      ],
      salt: 1n,
      signature: "0xabcd",
    },
  ]);
}
