import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {syncGrantStatusEventToHalo} from "../../lib/grantStatusSync.mjs";
import {GRANT_STATUS} from "../../lib/grantStatus.mjs";

describe("Halo grant status sync", () => {
  it("posts normalized relayer status events to the internal status sync route", async () => {
    const event = {
      taskId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      grantId: "grant-001",
      status: GRANT_STATUS.PAID,
      rawStatus: "200",
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      logs: [],
      receivedAt: "2026-06-10T10:00:00.000Z",
      source: "1shot",
    };
    const requests = [];
    const result = await syncGrantStatusEventToHalo({
      event,
      url: "http://127.0.0.1:3000/api/grants/sync",
      token: "secret",
      fetchImpl: async (url, init) => {
        requests.push({url, init});
        return Response.json({
          ok: true,
          grant: {
            status: GRANT_STATUS.PAID,
            eventCount: 2,
            taskIdHash: "sha256:task",
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.grantStatus, GRANT_STATUS.PAID);
    assert.equal(requests[0].url, "http://127.0.0.1:3000/api/grants/sync");
    assert.equal(requests[0].init.method, "POST");
    assert.equal(requests[0].init.headers.authorization, "Bearer secret");
    assert.deepEqual(JSON.parse(requests[0].init.body), event);
  });

  it("surfaces sync rejection without exposing raw identifiers", async () => {
    const result = await syncGrantStatusEventToHalo({
      event: {
        taskId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: GRANT_STATUS.PAID,
        rawStatus: "200",
        source: "1shot",
      },
      fetchImpl: async () =>
        Response.json(
          {
            ok: false,
            error: "unauthorized grant status sync",
          },
          {status: 401},
        ),
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.equal(result.issue, "unauthorized grant status sync");
    assert.equal(JSON.stringify(result).includes("0xaaaaaaaa"), false);
  });
});
