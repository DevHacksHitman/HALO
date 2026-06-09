export const LIVE_ESTIMATE_ENV_VAR: "HALO_ONESHOT_ESTIMATE_LIVE";
export const LIVE_SEND_ENV_VAR: "HALO_ONESHOT_LIVE";
export const METAMASK_CONTEXT_ENV_VAR: "HALO_METAMASK_PERMISSION_CONTEXT";

export const ESTIMATE_PREFLIGHT_STATUS: Readonly<{
  BLOCKED: "NO_GO_PREFLIGHT_BLOCKED";
  READY_DRY_RUN: "CONDITIONAL_GO_READY_DRY_RUN";
  READY_LIVE_ESTIMATE: "CONDITIONAL_GO_LIVE_ESTIMATE_READY";
}>;

export type OneShotEstimatePreflight = {
  step: 13;
  title: "1Shot live estimate preflight";
  status: string;
  chainId: 84532;
  endpoint: string;
  expectedEndpoint: string;
  realContextPresent: boolean;
  liveEstimateEnabled: boolean;
  liveSendEnabled: boolean;
  readyForNetworkEstimate: boolean;
  issues: string[];
  estimateReport: unknown | null;
  noGoFor: string[];
};

export function buildOneShotEstimatePreflight(args?: {
  permissionContext?: string;
  endpoint?: string;
  liveEstimateEnabled?: boolean;
  liveSendEnabled?: boolean;
  allowMainnetEndpoint?: boolean;
  usdcToken?: string;
  recipient?: string;
  amount?: string | number | bigint;
  destinationUrl?: string;
  memo?: string;
  requestId?: number;
}): OneShotEstimatePreflight;

export function runOneShotEstimateAfterPreflight(preflight: OneShotEstimatePreflight, options?: {
  id?: number;
  fetchImpl?: typeof fetch;
}): Promise<unknown>;

export function formatOneShotEstimatePreflightLogs(preflight: OneShotEstimatePreflight): string[];
