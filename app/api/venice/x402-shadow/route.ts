import {runVeniceX402ShadowProof} from "@/lib/demoProofs.mjs";

export const dynamic = "force-dynamic";

export async function POST() {
  const proof = await runVeniceX402ShadowProof();
  return Response.json(proof);
}
