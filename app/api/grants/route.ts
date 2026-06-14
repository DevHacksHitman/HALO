import {
  getGrantStatusPersistenceInfo,
  hashGrantStatusValue,
  listGrantStatuses,
  recordGrantStatus,
} from "@/lib/grantStatusPersistence.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const grants = await listGrantStatuses();

  return Response.json({
    grants: grants.map(toPublicGrantRecord),
    persistence: getGrantStatusPersistenceInfo(),
  });
}

export async function POST(request: Request) {
  if (!isAuthorizedGrantStatusSync(request)) {
    return Response.json(
      {
        ok: false,
        error: "unauthorized grant status sync",
      },
      {status: 401},
    );
  }

  try {
    const payload = await request.json();
    const grant = await recordGrantStatus(payload);

    return Response.json({
      ok: true,
      persistence: getGrantStatusPersistenceInfo(),
      grant: {
        status: grant.status,
        taskIdHash: hashGrantStatusValue(grant.taskId),
        txHashPresent: Boolean(grant.txHash),
        eventCount: grant.events.length,
        updatedAt: grant.updatedAt,
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "invalid grant status sync payload",
      },
      {status: 400},
    );
  }
}

function isAuthorizedGrantStatusSync(request: Request) {
  const token = process.env.HALO_GRANT_STATUS_SYNC_TOKEN?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  if (token) {
    return authorization === `Bearer ${token}`;
  }

  return process.env.NODE_ENV !== "production" && isLocalDevelopmentRequest(request);
}

function isLocalDevelopmentRequest(request: Request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function toPublicGrantRecord(grant: {
  taskId: string;
  txHash: string;
  events: Array<{txHash: string}>;
}) {
  return {
    ...grant,
    taskIdHash: hashGrantStatusValue(grant.taskId),
    txHashHash: grant.txHash ? hashGrantStatusValue(grant.txHash) : "",
    events: grant.events.map((event) => ({
      ...event,
      txHashHash: event.txHash ? hashGrantStatusValue(event.txHash) : "",
    })),
  };
}
