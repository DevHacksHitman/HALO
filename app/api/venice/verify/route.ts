import {runVeniceLiveVerifierProof} from "@/lib/demoProofs.mjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await readJsonBody(request);
  const proof = await runVeniceLiveVerifierProof({
    need: typeof payload.need === "string" && payload.need.trim() ? payload.need.trim() : undefined,
    requestedAmountUsd:
      typeof payload.requestedAmountUsd === "string" && payload.requestedAmountUsd.trim()
        ? payload.requestedAmountUsd.trim()
        : undefined,
  });

  return Response.json(proof);
}

async function readJsonBody(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}
