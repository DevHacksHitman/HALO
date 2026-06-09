import {createGrantStatusStore} from "../lib/grantStatus.mjs";

const store = createGrantStatusStore();
const taskId = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

console.log("[WEBHOOK] Route: POST /api/webhooks/1shot");
console.log("[STATUS] Route: GET /api/grants");

const queued = store.record({
  taskId,
  status: "submitted",
  metadata: {grantId: "grant-inhaler-001"},
  logs: ["relayer accepted delegated execution"],
  receivedAt: "2026-06-02T12:00:00.000Z",
});

console.log("");
console.log("[1Shot] submitted webhook normalized:");
console.log(JSON.stringify(queued, null, 2));

const paid = store.record({
  taskId,
  status: "tx_success",
  txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  metadata: {grantId: "grant-inhaler-001"},
  logs: ["transaction confirmed"],
  receivedAt: "2026-06-02T12:02:00.000Z",
});

console.log("");
console.log("[1Shot] success webhook appended:");
console.log(JSON.stringify(paid, null, 2));

console.log("");
console.log("[STATUS] latest grants:");
console.log(JSON.stringify(store.list(), null, 2));
console.log("[SECURITY] Local receiver validates shape. provider-specific signature verification is gated for live setup.");
