import {grantStatusStore, parseOneShotWebhookPayload} from "@/lib/grantStatus.mjs";
import {verifyOneShotWebhookSignature} from "@/lib/oneShotWebhookSignature.mjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const signature = verifyOneShotWebhookSignature(payload);
    const event = parseOneShotWebhookPayload(payload);
    const grant = grantStatusStore.record(event);

    return Response.json({
      ok: true,
      grant,
      signature,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "invalid 1Shot webhook payload",
      },
      {status: 400},
    );
  }
}
