export const PERMISSION_CONTEXT_ENV_VAR: "HALO_METAMASK_PERMISSION_CONTEXT";

export type PermissionContextHandoff = {
  step: 12;
  title: "Real MetaMask permission context handoff";
  verdict: "CONDITIONAL_GO_CONTEXT_READY_FOR_DECODE" | "CONDITIONAL_GO_LIVE_ESTIMATE_ONLY";
  contextEnvVar: "HALO_METAMASK_PERMISSION_CONTEXT";
  context: string;
  contextPreview: string;
  contextBytes: number;
  command: string;
  shellCommand: string;
  redactedShellCommand: string;
  liveEstimateEnabled: boolean;
  publicRecordingRule: string;
  noGoFor: string[];
};

export function buildPermissionContextHandoff(capture: unknown, options?: {
  command?: string;
  recordingSlow?: boolean;
  liveEstimate?: boolean;
}): PermissionContextHandoff;

export function redactPermissionCaptureForDisplay(capture: unknown, handoff?: PermissionContextHandoff): unknown;

export function formatPermissionContextHandoffLogs(handoff: PermissionContextHandoff): string[];
