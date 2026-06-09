import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
  HALO_PERMISSION_TYPE,
  createSerializableHaloPermissionRequest,
} from "../lib/haloPermissions.mjs";

const demoDonor = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const demoSession = process.env.NEXT_PUBLIC_HALO_SESSION_ACCOUNT_ADDRESS || "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const usdcToken = process.env.NEXT_PUBLIC_HALO_USDC_ADDRESS || BASE_SEPOLIA_USDC_ADDRESS;
const monthlyCapUsdc = process.env.NEXT_PUBLIC_HALO_MONTHLY_CAP_USDC || "100";

const request = createSerializableHaloPermissionRequest({
  donorAddress: demoDonor,
  sessionAccount: demoSession,
  usdcToken,
  monthlyCapUsdc,
  nowSeconds: 1_766_000_000,
});

console.log("[MetaMask] Smart Accounts Kit action: requestExecutionPermissions");
console.log(`[ERC-7715] Permission type: ${HALO_PERMISSION_TYPE}`);
console.log(`[EVM] chainId=${BASE_SEPOLIA_CHAIN_ID}`);
console.log(`[EVM] token=${usdcToken}`);
console.log(`[A2A] sessionAccount=${demoSession}`);
console.log("[SECURITY] Donor keeps USDC; Halo receives a scoped permission context only.");
console.log(JSON.stringify(request, null, 2));
