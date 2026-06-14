export type GrantStatus = "REQUESTED" | "VERIFYING" | "APPROVED" | "RELAYING" | "PAID" | "FAILED";

export interface GrantEvent {
  taskId: string;
  grantId: string;
  status: GrantStatus;
  rawStatus: string;
  txHash: string;
  logs: string[];
  receivedAt: string;
  source: string;
}

export interface GrantStatusRecord {
  grantId: string;
  taskId: string;
  status: GrantStatus;
  txHash: string;
  createdAt: string;
  updatedAt: string;
  events: GrantEvent[];
}

export const GRANT_STATUS: Record<GrantStatus, GrantStatus>;
export function parseOneShotWebhookPayload(payload: unknown, now?: Date): GrantEvent;
export function normalizeGrantEvent(event: unknown): GrantEvent;
export function reduceGrantEvent(currentGrant: GrantStatusRecord | null, event: GrantEvent): GrantStatusRecord;
export function createGrantStatusStore(): {
  record(payloadOrEvent: unknown): GrantStatusRecord;
  get(taskId: string): GrantStatusRecord | null;
  list(): GrantStatusRecord[];
  reset(): void;
};
export const grantStatusStore: ReturnType<typeof createGrantStatusStore>;
