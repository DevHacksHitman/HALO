import {formatA2ARedelegationProofLogs} from "../lib/a2aRedelegationProof.mjs";
import {buildStep23A2AProof} from "../lib/demoProofs.mjs";

console.log("[HALO] Step 23 A2A redelegation proof.");
console.log("[HALO] Goal: prove two-hop ERC-7710 redelegation across Verifier and Treasurer lanes.");
console.log("[BOUNDARY] Local deterministic proof only: no Venice call, no x402 settlement, no 1Shot send, no status/webhook sync, no mainnet claim.");
console.log(`[A2A] relayer target source=${process.env.ONESHOT_RELAYER_TARGET_WALLET_ADDRESS ? "ONESHOT_RELAYER_TARGET_WALLET_ADDRESS" : "deterministic local proof target"}.`);
console.log("");

const proof = buildStep23A2AProof();
const {verifierReport, treasurerReport, directReport} = proof.reports;

printLaneReport("Verifier lane", verifierReport);
printLaneReport("Treasurer lane", treasurerReport);
printLaneReport("Negative control: direct donor -> relayer", directReport);

console.log("");
console.log("[HALO] Step 23 public-safe summary:");
console.log(JSON.stringify(proof.publicSummary, null, 2));
console.log("");
console.log("[NEXT] Step 24 should run Base mainnet preflight only after A2A and 7702 readiness are aligned.");

function printLaneReport(label, report) {
  console.log(`[HALO] ${label}:`);
  for (const line of formatA2ARedelegationProofLogs(report)) {
    console.log(line);
  }
  console.log("");
}
