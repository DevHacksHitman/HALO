import {grantStatusStore} from "@/lib/grantStatus.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    grants: grantStatusStore.list(),
  });
}
