export const PERMISSION_CAPTURE_STATUS: Readonly<{
  HEX_CONTEXT_CAPTURED: "HEX_CONTEXT_CAPTURED";
  DECODE_REQUIRED: "DECODE_REQUIRED_BEFORE_1SHOT";
}>;

export type PermissionGrantDependency = {
  factory: `0x${string}`;
  factoryData: `0x${string}`;
  factoryDataBytes: number;
  factoryDataPreview: string;
  factoryDataHash: string;
};

export type PermissionGrantSummary = {
  source: "wallet_requestExecutionPermissions";
  status: "HEX_CONTEXT_CAPTURED";
  relayReadiness: "DECODE_REQUIRED_BEFORE_1SHOT";
  liveRelayReady: false;
  chainId: number;
  permissionType: string;
  context: `0x${string}`;
  contextBytes: number;
  contextPreview: string;
  delegationManager: `0x${string}`;
  dependencies: PermissionGrantDependency[];
  dependencyCount: number;
  grantKeys: string[];
  authorizationListPresent: boolean;
  authorizationListCount: number | null;
  capturedAt: string;
  nextAction: string;
};

export type PermissionCaptureReport = {
  step: 10;
  title: "MetaMask permission context capture";
  verdict: "CONDITIONAL_GO_CAPTURED_CONTEXT_ONLY";
  noGoFor: string[];
  expectedChainId: number;
  expectedPermissionType: string;
  summary: PermissionGrantSummary;
  safety: string[];
};

export function summarizePermissionGrant(
  grant: unknown,
  requestedPermission?: unknown,
): PermissionGrantSummary;
export function buildPermissionCaptureReport(
  grant: unknown,
  requestedPermission?: unknown,
): PermissionCaptureReport;
export function formatPermissionCaptureLogs(report: PermissionCaptureReport): string[];
