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
  chainProfile: string;
  chainLabel: string;
  chainId: number;
  endpoint: string;
  expectedEndpoint: string;
  usdcToken: string;
  baseMainnetUsdcToken: string | null;
  mainnetCapReport: unknown | null;
  destinationUrl: string;
  webhookUrlReadyForLiveSend: boolean;
  realContextPresent: boolean;
  fullGrantPresent: boolean;
  authorizationListPresent: boolean;
  authorizationListCount: number | null;
  authorizationListValid: boolean;
  authorizationListPassedThrough: boolean;
  smartAccountReadiness: unknown;
  smartAccountReadyForLiveSend: boolean;
  requireSmartAccountReadiness: boolean;
  a2aProof: unknown | null;
  requireA2A: boolean;
  a2aLane: string;
  a2aPublicClaimAllowed: boolean;
  liveEstimateEnabled: boolean;
  liveSendEnabled: boolean;
  readyForNetworkEstimate: boolean;
  rootDelegator: string;
  rootDelegate: string;
  rootDelegatorHash: string | null;
  rootDelegateHash: string | null;
  firstDelegationDelegate: string;
  finalDelegationDelegate: string;
  finalDelegationDelegateHash: string | null;
  expectedRelayerTargetWallet: string;
  delegateMatchesRelayerTarget: boolean | null;
  issues: string[];
  estimateReport: unknown | null;
  noGoFor: string[];
};

export function buildOneShotEstimatePreflight(args?: {
  permissionContext?: string;
  permissionGrantJson?: string;
  dependencyDeploymentTxs?: string;
  chainProfile?: string;
  endpoint?: string;
  liveEstimateEnabled?: boolean;
  liveSendEnabled?: boolean;
  allowMainnetEndpoint?: boolean;
  requireSmartAccountReadiness?: boolean;
  requireA2A?: boolean;
  a2aLane?: string;
  relayerTargetWallet?: string;
  feePaymentExecution?: unknown;
  feePaymentPlan?: unknown;
  estimateScenario?: string;
  accountCode?: string;
  mainnetMaxGrantUsdc?: string;
  mainnetMaxRelayerFeeUsdc?: string;
  extraIssues?: string[];
  usdcToken?: string;
  recipient?: string;
  amount?: string | number | bigint;
  destinationUrl?: string;
  requestId?: number;
}): OneShotEstimatePreflight;

export function runOneShotEstimateAfterPreflight(preflight: OneShotEstimatePreflight, options?: {
  id?: number;
  fetchImpl?: typeof fetch;
}): Promise<unknown>;

export function formatOneShotEstimatePreflightLogs(preflight: OneShotEstimatePreflight): string[];
