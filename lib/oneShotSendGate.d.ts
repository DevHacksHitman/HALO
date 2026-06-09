export const ESTIMATE_RESULT_ENV_VAR: "HALO_ONESHOT_ESTIMATE_RESULT";
export const LIVE_SEND_ENV_VAR: "HALO_ONESHOT_LIVE";

export const SEND_GATE_STATUS: Readonly<{
  BLOCKED: "NO_GO_SEND_BLOCKED";
  READY_DRY_RUN: "CONDITIONAL_GO_SEND_DRY_RUN";
  READY_LIVE_SEND: "CONDITIONAL_GO_LIVE_SEND_READY";
}>;

export type OneShotSendGate = {
  step: 14;
  title: "Capped 1Shot testnet send gate";
  status: string;
  chainId: 84532;
  endpoint: string;
  expectedEndpoint: string;
  realContextPresent: boolean;
  estimateResultPresent: boolean;
  estimateResultHash: string | null;
  liveSendEnabled: boolean;
  readyForNetworkSend: boolean;
  grantAmountAtoms: string | null;
  grantCapAtoms: string;
  issues: string[];
  estimateReport: unknown | null;
  sendRequest: unknown | null;
  noGoFor: string[];
};

export function buildOneShotSendGate(args?: {
  permissionContext?: string;
  estimateResult?: string | Record<string, unknown>;
  endpoint?: string;
  liveSendEnabled?: boolean;
  allowMainnetEndpoint?: boolean;
  usdcToken?: string;
  recipient?: string;
  amount?: string | number | bigint;
  destinationUrl?: string;
  memo?: string;
  requestId?: number;
}): OneShotSendGate;

export function runOneShotSendAfterGate(gate: OneShotSendGate, options?: {
  id?: number;
  fetchImpl?: typeof fetch;
}): Promise<unknown>;

export function parseEstimateResult(value: unknown): Record<string, unknown>;

export function formatOneShotSendGateLogs(gate: OneShotSendGate): string[];
