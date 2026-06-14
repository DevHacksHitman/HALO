export const BASE_SEPOLIA_CHAIN_ID: 84532;

export type DecodedPermissionEstimateReport = {
  chainId: number;
  estimateOnly: true;
  liveSendEnabled: false;
  decoded: {
    encodedContext: string;
    encodedContextHash: string;
    encodedByteLength: number;
    delegationCount: number;
    caveatCount: number;
    permissionContext: unknown[];
    reencodedContextHash: string;
    reencodeMatches: boolean;
    relayReady: true;
  };
  params: unknown;
  request: unknown;
};

export function decodeMetaMaskPermissionContext(encodedContext: string): DecodedPermissionEstimateReport["decoded"];

export function buildEstimateRequestFromPermissionContext(args: {
  permissionContext: string;
  executions: unknown[];
  chainId?: number;
  destinationUrl?: string;
  context?: string;
  taskId?: string;
  authorizationList?: unknown;
  requestId?: number;
}): DecodedPermissionEstimateReport;

export function buildBaseSepoliaEstimateRequestFromPermissionContext(args: Parameters<typeof buildEstimateRequestFromPermissionContext>[0]): DecodedPermissionEstimateReport;

export function formatDecodedPermissionEstimateLogs(report: DecodedPermissionEstimateReport): string[];
