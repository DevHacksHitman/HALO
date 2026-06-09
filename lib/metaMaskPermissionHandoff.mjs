import {normalizeHexData} from "./hex.mjs";
import {redactGrantDependencies} from "./metaMaskPermissionGrant.mjs";

export const PERMISSION_CONTEXT_ENV_VAR = "HALO_METAMASK_PERMISSION_CONTEXT";

export function buildPermissionContextHandoff(capture, options = {}) {
  const context = extractContext(capture);
  const command = options.command ?? "scripts/demo_step16_real_permission_estimate.sh";
  const recordingSlow = options.recordingSlow ?? true;
  const liveEstimate = options.liveEstimate === true;
  const contextPreview = shortHex(context);
  const envParts = [
    ...(recordingSlow ? ["HALO_RECORDING_SLOW=1"] : []),
    `${PERMISSION_CONTEXT_ENV_VAR}='${context}'`,
    ...(liveEstimate ? ["HALO_ONESHOT_ESTIMATE_LIVE=1"] : []),
  ];
  const redactedEnvParts = [
    ...(recordingSlow ? ["HALO_RECORDING_SLOW=1"] : []),
    `${PERMISSION_CONTEXT_ENV_VAR}='${contextPreview}'`,
    ...(liveEstimate ? ["HALO_ONESHOT_ESTIMATE_LIVE=1"] : []),
  ];

  return {
    step: 12,
    title: "Real MetaMask permission context handoff",
    verdict: liveEstimate
      ? "CONDITIONAL_GO_LIVE_ESTIMATE_ONLY"
      : "CONDITIONAL_GO_CONTEXT_READY_FOR_DECODE",
    contextEnvVar: PERMISSION_CONTEXT_ENV_VAR,
    context,
    contextPreview,
    contextBytes: byteLength(context),
    command,
    shellCommand: `${envParts.join(" ")} ${command}`,
    redactedShellCommand: `${redactedEnvParts.join(" ")} ${command}`,
    liveEstimateEnabled: liveEstimate,
    publicRecordingRule: "Show only the redacted command/context preview in public recordings.",
    noGoFor: liveEstimate ? ["live_1shot_send", "live_payout_claim"] : ["live_1shot_estimate", "live_1shot_send", "live_payout_claim"],
  };
}

export function redactPermissionCaptureForDisplay(capture, handoff = buildPermissionContextHandoff(capture)) {
  const dependencies = capture?.summary?.dependencies;

  return {
    ...capture,
    summary: {
      ...capture.summary,
      context: handoff.contextPreview,
      contextRedacted: true,
      dependencies: Array.isArray(dependencies) ? redactGrantDependencies(dependencies) : dependencies,
    },
    handoff: {
      step: handoff.step,
      title: handoff.title,
      verdict: handoff.verdict,
      contextEnvVar: handoff.contextEnvVar,
      contextPreview: handoff.contextPreview,
      contextBytes: handoff.contextBytes,
      redactedShellCommand: handoff.redactedShellCommand,
      publicRecordingRule: handoff.publicRecordingRule,
      liveEstimateEnabled: handoff.liveEstimateEnabled,
    },
  };
}

export function formatPermissionContextHandoffLogs(handoff) {
  return [
    `[MetaMask] Context handoff ready: ${handoff.contextPreview}.`,
    `[SECURITY] Full context is copied locally; public recording should show redacted context only.`,
    `[1Shot] Next private command: ${handoff.redactedShellCommand}.`,
    handoff.liveEstimateEnabled
      ? "[1Shot] Live estimate opt-in is enabled; live send remains disabled."
      : "[NO-GO] Live estimate/send remain disabled until explicit opt-in.",
  ];
}

function extractContext(capture) {
  const value = capture?.summary?.context ?? capture?.context;
  return normalizeHexData(value, "permission context handoff");
}

function byteLength(hexData) {
  return (hexData.length - 2) / 2;
}

function shortHex(value) {
  if (value.length <= 22) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-10)}`;
}
