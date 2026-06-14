"use client";

import {useEffect, useMemo, useState} from "react";
import Link from "next/link";

type Grant = {
  grantId: string;
  taskId: string;
  status: string;
  txHash: string;
  updatedAt: string;
  events: unknown[];
};

type PersistenceInfo = {
  mode: string;
  persistent: boolean;
};

export function DemoCockpitClient() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [persistence, setPersistence] = useState<PersistenceInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const totals = useMemo(() => summarizeGrants(grants), [grants]);
  const latest = grants[0] ?? null;

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/grants", {cache: "no-store"});
        if (!response.ok) {
          throw new Error(`/api/grants returned HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (active) {
          setGrants(Array.isArray(payload.grants) ? payload.grants : []);
          setPersistence(payload.persistence && typeof payload.persistence === "object" ? payload.persistence : null);
          setError("");
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    }

    load();
    const interval = window.setInterval(load, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section className="demo-cockpit" aria-label="Halo demo cockpit">
      <div className="cockpit-status">
        <div>
          <div className="section-kicker">Demo lane</div>
          <h2>Base Sepolia proof path, mainnet gated.</h2>
          <p>
            The frontend demo shows the product loop. Paid state still comes from
            relayer status or verified webhook data only.
          </p>
        </div>
        <div className="cockpit-metrics" aria-label="Current grant status metrics">
          <Metric label="Grant records" value={String(totals.total)} />
          <Metric label="Paid" value={String(totals.paid)} />
          <Metric label="Relaying" value={String(totals.relaying)} />
          <Metric label="Status store" value={persistence?.persistent ? "durable" : "local"} />
        </div>
      </div>

      <div className="proof-rail" aria-label="Protocol proof rail">
        <RailItem label="MetaMask" state="live permission" detail="Donor grants scoped USDC authority." href="/donor" />
        <RailItem label="Venice" state="live verifier" detail="Requester receipt becomes structured grant reasoning." href="/request" />
        <RailItem label="x402" state="shadow only" detail="Payment requirement captured without settlement." href="/request" />
        <RailItem label="A2A" state="local proof" detail="Two-hop Verifier and Treasurer lanes." href="/request" />
        <RailItem
          label="1Shot"
          state={totals.paid > 0 ? "confirmed paid" : "status-backed"}
          detail={totals.paid > 0 ? "Terminal status confirmed in /status." : "No fake paid state shown."}
          href="/status"
        />
      </div>

      <article className="latest-grant" aria-label="Latest grant status">
        <span>Latest status</span>
        {latest ? (
          <>
            <strong>{latest.status}</strong>
            <p>
              {latest.grantId} updated {formatTimestamp(latest.updatedAt)}. Events: {latest.events.length}.
            </p>
          </>
        ) : (
          <>
            <strong>{loaded ? "No runtime events" : "Loading"}</strong>
            <p>{error || "Run status repoll or receive a webhook to populate this panel."}</p>
          </>
        )}
      </article>
    </section>
  );
}

function Metric({label, value}: {label: string; value: string}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RailItem({
  label,
  state,
  detail,
  href,
}: {
  label: string;
  state: string;
  detail: string;
  href: string;
}) {
  return (
    <Link className="rail-item" href={href}>
      <span>{label}</span>
      <strong>{state}</strong>
      <p>{detail}</p>
    </Link>
  );
}

function summarizeGrants(grants: Grant[]) {
  return grants.reduce(
    (summary, grant) => ({
      total: summary.total + 1,
      paid: summary.paid + (grant.status === "PAID" ? 1 : 0),
      relaying: summary.relaying + (grant.status === "RELAYING" ? 1 : 0),
    }),
    {total: 0, paid: 0, relaying: 0},
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "at an unknown time";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
