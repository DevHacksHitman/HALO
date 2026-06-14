import type {GrantEvent, GrantStatusRecord} from "./grantStatus.mjs";

export const UPSTASH_REDIS_REST_URL_ENV_VAR: "UPSTASH_REDIS_REST_URL";
export const UPSTASH_REDIS_REST_TOKEN_ENV_VAR: "UPSTASH_REDIS_REST_TOKEN";
export const UPSTASH_REDIS_REST_URL_FALLBACK_ENV_VARS: readonly string[];
export const UPSTASH_REDIS_REST_TOKEN_FALLBACK_ENV_VARS: readonly string[];
export const GRANT_STATUS_REDIS_KEY_ENV_VAR: "HALO_GRANT_STATUS_REDIS_KEY";
export const DEFAULT_GRANT_STATUS_REDIS_KEY: "halo:grant-status-events";

export interface GrantStatusPersistenceInfo {
  mode: "memory" | "upstash-redis";
  persistent: boolean;
  configured: boolean;
  key: string;
  host: string;
}

export function normalizeGrantPayloadToEvent(payloadOrEvent: unknown, now?: Date): GrantEvent;
export function getGrantStatusPersistenceInfo(options?: {env?: NodeJS.ProcessEnv}): GrantStatusPersistenceInfo;
export function recordGrantStatus(
  payloadOrEvent: unknown,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    memoryStore?: {
      record(payloadOrEvent: unknown): GrantStatusRecord;
      list(): GrantStatusRecord[];
    };
    now?: Date;
  },
): Promise<GrantStatusRecord>;
export function listGrantStatuses(options?: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  memoryStore?: {
    list(): GrantStatusRecord[];
  };
}): Promise<GrantStatusRecord[]>;
export function reduceGrantEvents(events: GrantEvent[]): GrantStatusRecord[];
export function hashGrantStatusValue(value: unknown): string;
