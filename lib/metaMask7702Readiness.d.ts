export const EIP7702_DELEGATION_PREFIX: "0xef0100";

export const SMART_ACCOUNT_7702_STATUS: Readonly<{
  READY_EXPECTED_DELEGATOR: "CONDITIONAL_GO_7702_EXPECTED_DELEGATOR";
  READY_AUTHORIZATION_LIST: "CONDITIONAL_GO_7702_AUTHORIZATION_LIST";
  READY_DEPENDENCIES: "CONDITIONAL_GO_7702_DEPENDENCIES_PENDING_DEPLOY";
  BLOCKED_NO_PATH: "NO_GO_7702_NO_SMART_ACCOUNT_PATH";
  BLOCKED_UNEXPECTED_DELEGATOR: "NO_GO_7702_UNEXPECTED_DELEGATOR";
  CHECK_NON_7702_CODE: "CHECK_ACCOUNT_CODE_NOT_7702";
}>;

export type SmartAccount7702ReadinessReport = {
  status: string;
  readyForLiveSend: boolean;
  code: string;
  hasCode: boolean;
  eip7702Delegator: string;
  expectedDelegator: string;
  authorizationCount: number;
  dependencyCount: number;
  dependenciesDeployed: boolean;
  issues: string[];
  noGoFor: string[];
};

export function classifySmartAccount7702Readiness(args?: {
  accountCode?: string | null;
  expectedDelegatorAddress?: string;
  chainId?: number | string;
  authorizationList?: unknown;
  dependencyCount?: number;
  dependenciesDeployed?: boolean;
}): SmartAccount7702ReadinessReport;

export function getAccountCode7702Readiness(args: {
  publicClient: {
    getCode: (args: {address: `0x${string}`}) => Promise<string | undefined>;
  };
  address: string;
  expectedDelegatorAddress?: string;
  chainId?: number | string;
  authorizationList?: unknown;
  dependencyCount?: number;
  dependenciesDeployed?: boolean;
}): Promise<SmartAccount7702ReadinessReport>;

export function formatSmartAccount7702ReadinessLogs(report: SmartAccount7702ReadinessReport): string[];
