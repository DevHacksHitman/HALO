export const PERMISSION_GRANT_ENV_VAR: "HALO_METAMASK_PERMISSION_GRANT_JSON";
export const DEPENDENCY_TXS_ENV_VAR: "HALO_METAMASK_DEPENDENCY_TXS";

export const DEPENDENCY_PLAN_STATUS: Readonly<{
  NONE: "CONDITIONAL_GO_NO_DEPENDENCIES";
  READY: "CONDITIONAL_GO_DEPENDENCIES_DEPLOYED";
  BLOCKED: "NO_GO_DEPENDENCIES_UNDEPLOYED";
}>;

export type PermissionGrantDependency = {
  factory: `0x${string}`;
  factoryData: `0x${string}`;
  factoryDataBytes: number;
  factoryDataPreview: string;
  factoryDataHash: string;
};

export type DependencyDeploymentPlan = {
  status: typeof DEPENDENCY_PLAN_STATUS[keyof typeof DEPENDENCY_PLAN_STATUS];
  dependencyCount: number;
  deployedCount: number;
  dependenciesPresent: boolean;
  dependenciesDeployed: boolean;
  deployments: Array<{
    index: number;
    factory: `0x${string}`;
    factoryData: `0x${string}`;
    factoryDataBytes: number;
    factoryDataPreview: string;
    factoryDataHash: string;
    tx: {
      to: `0x${string}`;
      value: "0x0";
      data: `0x${string}`;
    };
    deploymentTxHash: string | null;
    deployed: boolean;
  }>;
  deploymentTxs: string[];
  issues: string[];
};

export function parsePermissionGrantJson(value?: unknown): Record<string, unknown> | null;
export function serializePermissionGrantForEnv(grant: unknown): string;
export function summarizePermissionGrantShape(grant: unknown): {
  grantKeys: string[];
  authorizationListPresent: boolean;
  authorizationListCount: number | null;
  authorizationListValid: boolean;
};
export function normalizeAuthorizationList(value: unknown): unknown[] | undefined;
export function normalizeGrantDependencies(value: unknown): PermissionGrantDependency[];
export function buildDependencyDeploymentPlan(args?: {
  grant?: unknown;
  dependencies?: unknown;
  deploymentTxs?: unknown;
}): DependencyDeploymentPlan;
export function redactDependencyDeploymentPlan(plan: DependencyDeploymentPlan): unknown;
export function redactGrantDependencies(dependencies: unknown): unknown[];
export function buildPermissionGrantEnvCommand(args?: {
  grantJson?: string;
  dependencyTxs?: string[];
  command?: string;
  recordingSlow?: boolean;
}): string;
export function formatDependencyDeploymentLogs(plan: DependencyDeploymentPlan): string[];
