import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {describe, it} from "node:test";

describe("/status grant UI boundary", () => {
  it("renders real grant state from /api/grants instead of static paid samples", async () => {
    const page = await readFile(new URL("../../app/status/page.tsx", import.meta.url), "utf8");
    const client = await readFile(new URL("../../components/GrantStatusClient.tsx", import.meta.url), "utf8");
    const uiData = await readFile(new URL("../../lib/uiData.ts", import.meta.url), "utf8");

    assert.match(page, /GrantStatusClient/);
    assert.doesNotMatch(page, /statusCards/);
    assert.match(client, /fetch\("\/api\/grants"/);
    assert.doesNotMatch(uiData, /Webhook success sample/);
    assert.doesNotMatch(uiData, /statusCards/);
  });
});
