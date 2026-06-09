import {createHaloPermissionRequest} from "../lib/haloPermissions.mjs";
import {
  buildPermissionCaptureReport,
  formatPermissionCaptureLogs,
} from "../lib/metaMaskPermissionCapture.mjs";

const donorAddress = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const sessionAccount = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const request = createHaloPermissionRequest({
  donorAddress,
  sessionAccount,
  nowSeconds: 1_766_000_000,
});

const capturedGrant = {
  ...request,
  chainId: "0x14a34",
  context: "0x1234abcd5678ef90",
  delegationManager: "0xcccccccccccccccccccccccccccccccccccccccc",
  dependencies: [
    {
      factory: "0xdddddddddddddddddddddddddddddddddddddddd",
      factoryData: "0x",
    },
  ],
};

const report = buildPermissionCaptureReport(capturedGrant, request);

for (const line of formatPermissionCaptureLogs(report)) {
  console.log(line);
}

console.log("");
console.log("[HALO] Step 10 capture report:");
console.log(JSON.stringify(report, null, 2));

console.log("");
console.log("[NEXT] Decode real MetaMask permission context, then run 1Shot estimate. Live send stays gated.");
