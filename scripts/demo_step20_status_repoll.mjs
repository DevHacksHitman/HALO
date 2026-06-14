import {readFile} from "node:fs/promises";

import {getHaloChainProfile} from "../lib/chainProfiles.mjs";
import {syncGrantStatusEventToHalo} from "../lib/grantStatusSync.mjs";
import {
  buildStatusRePollReport,
  formatStatusRePollLogs,
  resolveStatusRePollTaskId,
} from "../lib/oneShotStatusRePoll.mjs";
import {pollOneShotRelayStatus} from "../lib/oneShotRelayConfirmation.mjs";

const step = Number(process.env.HALO_STATUS_REPOLL_STEP || "20");
const profile = getHaloChainProfile(process.env.HALO_CHAIN_PROFILE || "base-sepolia");
const endpoint = profile.relayerRpcUrl || process.env.ONESHOT_RELAYER_RPC_URL;
const localArtifactPath = process.env.HALO_ONESHOT_LOCAL_ARTIFACT_PATH || ".halo-local/oneshot-step20-latest.json";
const pollAttempts = Number(process.env.HALO_STATUS_REPOLL_ATTEMPTS || process.env.HALO_STEP20_STATUS_POLL_ATTEMPTS || "8");
const pollIntervalMs = Number(
  process.env.HALO_STATUS_REPOLL_INTERVAL_MS || process.env.HALO_STEP20_STATUS_POLL_INTERVAL_MS || "3000",
);
const logs = process.env.HALO_STATUS_REPOLL_LOGS !== "0";
const artifact = await readLocalArtifactSafely(localArtifactPath);
const {taskId, source} = resolveStatusRePollTaskId({step, artifact});
const syncEnabled = process.env.HALO_GRANT_STATUS_SYNC !== "0";
let statusPoll = null;
let pollIssue = "";
let syncResult = null;

console.log("[HALO] Step 20 status-only TaskId repoll.");
console.log("[SECURITY] This script never estimates, sends, or resends a 1Shot transaction.");
console.log("[SECURITY] Raw TaskId, status payload, and tx hash stay local-only; public output uses hashes.");
console.log(`[CHAIN] profile=${profile.id}, label=${profile.label}, chainId=${profile.chainId}.`);
console.log(`[1Shot] endpoint=${endpoint}.`);
console.log(`[1Shot] attempts=${pollAttempts}, intervalMs=${pollIntervalMs}, logs=${logs}.`);
console.log(`[STATUS] local artifact present=${Boolean(artifact)}.`);
console.log(`[STATUS] sync enabled=${syncEnabled}.`);
console.log("");

if (taskId) {
  try {
    statusPoll = await pollOneShotRelayStatus({
      taskId,
      endpoint,
      attempts: pollAttempts,
      intervalMs: pollIntervalMs,
      logs,
      id: step,
    });
  } catch (error) {
    pollIssue = `1Shot status-only poll failed: ${error.message}`;
  }
}

if (syncEnabled && statusPoll?.classification?.event) {
  try {
    syncResult = await syncGrantStatusEventToHalo({
      event: statusPoll.classification.event,
    });
  } catch (error) {
    syncResult = {
      attempted: true,
      ok: false,
      status: 0,
      issue: `grant status sync failed: ${error.message}`,
    };
  }
}

const report = buildStatusRePollReport({
  step,
  taskId,
  taskIdSource: source,
  endpoint,
  chainProfile: profile.id,
  statusPoll,
  pollIssue,
});

for (const line of formatStatusRePollLogs(report)) {
  console.log(line);
}

if (syncResult?.attempted) {
  console.log(`[STATUS] /status sync ok=${syncResult.ok}.`);
  console.log(`[STATUS] /status sync HTTP=${syncResult.status}.`);
  if (syncResult.grantStatus) {
    console.log(`[STATUS] /status synced grant=${syncResult.grantStatus}.`);
  }
  if (syncResult.taskIdHash) {
    console.log(`[STATUS] /status synced task hash=${syncResult.taskIdHash}.`);
  }
  if (syncResult.issue) {
    console.log(`[NO-GO] ${syncResult.issue}.`);
  }
}

console.log(
  JSON.stringify(
    {
      step: report.step,
      status: report.status,
      chainProfile: report.chainProfile,
      endpoint: report.endpoint,
      taskIdPresent: report.taskIdPresent,
      taskIdSource: report.taskIdSource,
      taskIdHash: report.taskIdHash,
      pollAttempts: report.pollAttempts,
      grantStatus: report.grantStatus,
      rawStatus: report.rawStatus,
      txHashPresent: report.txHashPresent,
      txHashHash: report.txHashHash,
      statusResultHash: report.statusResultHash,
      grantStatusSynced: syncResult?.ok ?? false,
      issues: report.issues,
      noGoFor: report.noGoFor,
    },
    null,
    2,
  ),
);

console.log("");
console.log("[NEXT] If this remains non-terminal, wait or rely on signed webhook. A new TaskId requires a new relay send.");

async function readLocalArtifactSafely(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}
