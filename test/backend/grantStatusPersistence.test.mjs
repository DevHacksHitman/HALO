import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {describe, it} from "node:test";

import {GRANT_STATUS, createGrantStatusStore} from "../../lib/grantStatus.mjs";
import {
  DEFAULT_GRANT_STATUS_REDIS_KEY,
  getGrantStatusPersistenceInfo,
  listGrantStatuses,
  recordGrantStatus,
} from "../../lib/grantStatusPersistence.mjs";

const txHash = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

describe("Halo grant status persistence", () => {
  it("falls back to the existing memory reducer when Upstash is not configured", async () => {
    const memoryStore = createGrantStatusStore();
    const grant = await recordGrantStatus(
      {
        taskId: "task-memory",
        status: "success",
        txHash,
        receivedAt: "2026-06-11T09:00:00.000Z",
      },
      {
        env: {},
        memoryStore,
      },
    );

    assert.equal(grant.status, GRANT_STATUS.PAID);
    assert.equal(grant.txHash, txHash);
    assert.equal(memoryStore.list().length, 1);
    assert.deepEqual(getGrantStatusPersistenceInfo({env: {}}), {
      mode: "memory",
      persistent: false,
      configured: false,
      key: "",
      host: "",
    });
  });

  it("appends normalized events to Upstash and replays them through the reducer", async () => {
    const fake = createFakeUpstashFetch();
    const env = {
      UPSTASH_REDIS_REST_URL: "https://heroic-mole-12345.upstash.io/",
      UPSTASH_REDIS_REST_TOKEN: "secret-token",
      HALO_GRANT_STATUS_REDIS_KEY: "halo:test-grant-events",
    };

    const grant = await recordGrantStatus(
      {
        taskId: "task-upstash",
        status: 200,
        receipt: {transactionHash: txHash},
        receivedAt: "2026-06-11T09:10:00.000Z",
      },
      {
        env,
        fetchImpl: fake.fetch,
      },
    );

    assert.equal(grant.status, GRANT_STATUS.PAID);
    assert.equal(grant.txHash, txHash);
    assert.equal(grant.events.length, 1);
    assert.deepEqual(fake.commands.map((entry) => entry.command[0]), ["RPUSH", "LRANGE"]);
    assert.equal(fake.commands[0].url, "https://heroic-mole-12345.upstash.io");
    assert.deepEqual(fake.commands[0].command.slice(0, 2), ["RPUSH", "halo:test-grant-events"]);
    assert.equal(fake.commands[0].headers.authorization, "Bearer secret-token");
    assert.match(fake.commands[0].command[2], /"status":"PAID"/);

    const info = getGrantStatusPersistenceInfo({env});
    assert.equal(info.mode, "upstash-redis");
    assert.equal(info.host, "heroic-mole-12345.upstash.io");
    assert.equal(info.key, "halo:test-grant-events");
    assert.doesNotMatch(JSON.stringify(info), /secret-token/);
  });

  it("accepts Vercel Upstash integration env names when canonical aliases are locked", async () => {
    const fake = createFakeUpstashFetch();
    const env = {
      UPSTASH_REDIS_REST_KV_REST_API_URL: "https://vercel-generated.upstash.io/",
      UPSTASH_REDIS_REST_KV_REST_API_TOKEN: "integration-token",
      HALO_GRANT_STATUS_REDIS_KEY: "halo:vercel-generated",
    };

    const grant = await recordGrantStatus(
      {
        taskId: "task-vercel-integration",
        status: 200,
        receipt: {transactionHash: txHash},
        receivedAt: "2026-06-14T17:15:00.000Z",
      },
      {
        env,
        fetchImpl: fake.fetch,
      },
    );

    assert.equal(grant.status, GRANT_STATUS.PAID);
    assert.equal(fake.commands[0].url, "https://vercel-generated.upstash.io");
    assert.equal(fake.commands[0].headers.authorization, "Bearer integration-token");
    assert.deepEqual(fake.commands[0].command.slice(0, 2), ["RPUSH", "halo:vercel-generated"]);

    const info = getGrantStatusPersistenceInfo({env});
    assert.equal(info.mode, "upstash-redis");
    assert.equal(info.host, "vercel-generated.upstash.io");
  });

  it("lists persisted events newest first and preserves paid status against late pending events", async () => {
    const fake = createFakeUpstashFetch([
      {
        taskId: "task-old",
        grantId: "task-old",
        status: "RELAYING",
        rawStatus: "110",
        txHash: "",
        logs: [],
        receivedAt: "2026-06-11T09:00:00.000Z",
        source: "1shot",
      },
      {
        taskId: "task-paid",
        grantId: "task-paid",
        status: "PAID",
        rawStatus: "200",
        txHash,
        logs: [],
        receivedAt: "2026-06-11T09:05:00.000Z",
        source: "1shot",
      },
      {
        taskId: "task-paid",
        grantId: "task-paid",
        status: "RELAYING",
        rawStatus: "110",
        txHash: "",
        logs: [],
        receivedAt: "2026-06-11T09:06:00.000Z",
        source: "1shot",
      },
    ]);

    const grants = await listGrantStatuses({
      env: {
        UPSTASH_REDIS_REST_URL: "https://heroic-mole-12345.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "secret-token",
      },
      fetchImpl: fake.fetch,
    });

    assert.equal(grants.length, 2);
    assert.equal(grants[0].taskId, "task-paid");
    assert.equal(grants[0].status, GRANT_STATUS.PAID);
    assert.equal(grants[0].events.length, 2);
    assert.equal(grants[1].taskId, "task-old");
    assert.deepEqual(fake.commands[0].command, ["LRANGE", DEFAULT_GRANT_STATUS_REDIS_KEY, "0", "-1"]);
  });

  it("surfaces Upstash command failures without mutating the memory fallback", async () => {
    const memoryStore = createGrantStatusStore();
    const fetchImpl = async () => ({
      ok: false,
      status: 401,
      json: async () => ({error: "ERR invalid token"}),
    });

    await assert.rejects(
      () =>
        recordGrantStatus(
          {
            taskId: "task-fail",
            status: "success",
          },
          {
            env: {
              UPSTASH_REDIS_REST_URL: "https://heroic-mole-12345.upstash.io",
              UPSTASH_REDIS_REST_TOKEN: "bad-token",
            },
            fetchImpl,
            memoryStore,
          },
        ),
      /ERR invalid token/,
    );
    assert.deepEqual(memoryStore.list(), []);
  });

  it("routes grant APIs and 1Shot webhooks through the persistence adapter", async () => {
    const routeFiles = await Promise.all([
      readFile(new URL("../../app/api/grants/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../../app/api/grants/sync/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../../app/api/webhooks/1shot/route.ts", import.meta.url), "utf8"),
    ]);
    const joined = routeFiles.join("\n");

    assert.match(joined, /recordGrantStatus/);
    assert.match(joined, /listGrantStatuses/);
    assert.match(joined, /getGrantStatusPersistenceInfo/);
    assert.doesNotMatch(joined, /grantStatusStore\.record/);
  });
});

function createFakeUpstashFetch(initialEvents = []) {
  const commands = [];
  const events = initialEvents.map((event) => JSON.stringify(event));

  return {
    commands,
    fetch: async (url, init = {}) => {
      const command = JSON.parse(init.body);
      commands.push({
        url,
        command,
        headers: init.headers,
      });

      if (command[0] === "RPUSH") {
        events.push(command[2]);
        return jsonResponse({result: events.length});
      }

      if (command[0] === "LRANGE") {
        return jsonResponse({result: events});
      }

      return jsonResponse({error: `unsupported command ${command[0]}`}, {ok: false, status: 400});
    },
  };
}

function jsonResponse(body, {ok = true, status = 200} = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}
