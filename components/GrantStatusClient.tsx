"use client";

import {useEffect, useMemo, useState} from "react";

type GrantEvent = {
  status: string;
  rawStatus: string;
  txHash: string;
  logs: string[];
  receivedAt: string;
  source: string;
};

type Grant = {
  grantId: string;
  taskId: string;
  taskIdHash?: string;
  status: string;
  txHash: string;
  txHashHash?: string;
  createdAt: string;
  updatedAt: string;
  events: GrantEvent[];
};

type PersistenceInfo = {
  mode: string;
  persistent: boolean;
};

const POLL_INTERVAL_MS = 5000;

export function GrantStatusClient() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [persistence, setPersistence] = useState<PersistenceInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadGrants() {
      try {
        const response = await fetch("/api/grants", {cache: "no-store"});
        if (!response.ok) {
          throw new Error(`/api/grants returned HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        setGrants(Array.isArray(payload.grants) ? payload.grants : []);
        setPersistence(payload.persistence && typeof payload.persistence === "object" ? payload.persistence : null);
        setError("");
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    }

    loadGrants();
    const interval = window.setInterval(loadGrants, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const totals = useMemo(() => summarizeGrants(grants), [grants]);
  const persistenceLabel = persistence?.mode === "upstash-redis" ? "Upstash" : "In-memory";
  const persistenceDetail = persistence?.mode === "upstash-redis"
    ? "Grant history is durable across deploys."
    : "Dev mode, history resets on restart.";

  return (
    <section className="status-console" aria-label="Grant status from API">
      <div className="status-summary" aria-label="Grant status totals">
        <div className="metric">
          <span>Grant records</span>
          <strong>{totals.total}</strong>
          <p>Real records from <code>/api/grants</code>.</p>
        </div>
        <div className="metric">
          <span>In relay</span>
          <strong>{totals.relaying}</strong>
          <p>Submitted or tracked, not terminal.</p>
        </div>
        <div className="metric">
          <span>Confirmed sent</span>
          <strong>{totals.paid}</strong>
          <p>Terminal 1Shot status or webhook only.</p>
        </div>
        <div className="metric">
          <span>Persistence</span>
          <strong>{persistenceLabel}</strong>
          <p>{persistenceDetail}</p>
        </div>
      </div>

      {error ? <p className="status-alert">Status API unavailable: {error}</p> : null}

      <section className="status-grid" aria-label="Grant status records">
        {loaded && grants.length === 0 ? (
          <article className="status-empty">
            <span>No proof loaded</span>
            <h2>No 1Shot status event is loaded yet.</h2>
            <p>
              When a Step 20 status poll or signed 1Shot webhook is synced, the
              confirmed grant appears here. Halo does not create a paid state from
              static sample data.
            </p>
          </article>
        ) : null}

        {grants.map((grant) => (
          <article key={grant.taskId} className={`status-card ${grant.status.toLowerCase()}`}>
            <div className="status-card-header">
              <span>{formatUserStatus(grant.status)}</span>
              <time dateTime={grant.updatedAt}>{formatTimestamp(grant.updatedAt)}</time>
            </div>
            <h2>{formatGrantTitle(grant)}</h2>
            <p>{formatGrantDetail(grant)}</p>
            <dl className="status-meta">
              <div>
                <dt>Task ref</dt>
                <dd><code>{formatPublicReference(grant.taskIdHash || grant.taskId)}</code></dd>
              </div>
              <div>
                <dt>Tx ref</dt>
                <dd><code>{grant.txHash ? formatPublicReference(grant.txHashHash || grant.txHash) : "pending"}</code></dd>
              </div>
              <div>
                <dt>Status events</dt>
                <dd>{grant.events.length}</dd>
              </div>
            </dl>
            <details className="status-proof-details">
              <summary>Relay proof</summary>
              <p>
                Confirmed sent requires <code>relayer_getStatus=200</code> or a signed
                webhook. Latest raw status: {grant.events.at(-1)?.rawStatus ?? grant.status}.
              </p>
            </details>
          </article>
        ))}
      </section>
    </section>
  );
}

function summarizeGrants(grants: Grant[]) {
  return grants.reduce(
    (summary, grant) => ({
      total: summary.total + 1,
      relaying: summary.relaying + (grant.status === "RELAYING" ? 1 : 0),
      paid: summary.paid + (grant.status === "PAID" ? 1 : 0),
    }),
    {total: 0, relaying: 0, paid: 0},
  );
}

function formatGrantDetail(grant: Grant) {
  const latestEvent = grant.events.at(-1);

  if (grant.status === "PAID") {
    return grant.txHash
      ? "1Shot terminal confirmation recorded with a transaction reference."
      : "1Shot terminal confirmation recorded.";
  }

  if (grant.status === "FAILED") {
    return "The relayer reported a terminal failure. This grant needs review before retry.";
  }

  if (grant.status === "RELAYING") {
    return "The relay task is being tracked. Halo is waiting for terminal confirmation.";
  }

  return `Latest update: ${latestEvent?.rawStatus ?? grant.status}.`;
}

function formatUserStatus(status: string) {
  if (status === "PAID") {
    return "Confirmed paid";
  }
  if (status === "RELAYING") {
    return "In relay";
  }
  if (status === "FAILED") {
    return "Needs review";
  }
  if (status === "APPROVED") {
    return "Approved";
  }
  if (status === "VERIFYING") {
    return "Checking";
  }

  return "Requested";
}

function formatGrantTitle(grant: Grant) {
  if (grant.status === "PAID") {
    return "Grant payout confirmed.";
  }
  if (grant.status === "RELAYING") {
    return "Relay in progress.";
  }
  if (grant.status === "FAILED") {
    return "Relay needs review.";
  }

  return "Request update.";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return date.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function formatPublicReference(value: string) {
  if (value.length <= 22) {
    return value;
  }

  return `${value.slice(0, 14)}...${value.slice(-8)}`;
}
