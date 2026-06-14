import {buildStep23A2APublicProof} from "@/lib/demoProofs.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(buildStep23A2APublicProof());
}
