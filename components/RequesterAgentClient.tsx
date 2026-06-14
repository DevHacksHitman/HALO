"use client";

import {useMemo, useState} from "react";

type ProofState<T> = {
  loading: boolean;
  error: string;
  data: T | null;
};

type VeniceVerifyProof = {
  ok: boolean;
  request?: {
    need: string;
    requestedAmountUsd: string;
    model: string;
    receiptHash: string;
    syntheticReceipt?: {
      vendor: string;
      item: string;
      category: string;
      date: string;
      totalUsd: string;
      synthetic: boolean;
    };
  };
  report?: {
    status: string;
    responseStatus: number | null;
    parsedResult: {
      valid: boolean;
      extractedAmountAtoms: string;
      category: string;
      reason: string;
      grantMessage: string;
    } | null;
    decision: {
      approved: boolean;
      requestedAmountAtoms: string;
      extractedAmountAtoms: string;
      reason: string;
    } | null;
    requesterMessage: string;
    issues: string[];
  };
};

type X402ShadowProof = {
  ok: boolean;
  request?: {
    endpoint: string;
    method: string;
    x402PaymentHeaderSent: boolean;
    bodySent: boolean;
  };
  summary?: {
    status: string;
    responseStatus: number | null;
    paymentRequirementCaptured: boolean;
    settlementReady: boolean;
    selectedOffer: {
      network: string;
      asset: string;
      payToHash: string;
      amountAtoms: string;
    } | null;
    packageReadiness: {
      allAvailable: boolean;
      missingPackages: string[];
    } | null;
    issues: string[];
  };
};

type A2AProof = {
  ok: boolean;
  summary?: {
    status: string;
    publicA2AClaimAllowed: boolean;
    verifierLane: A2ALane;
    treasurerLane: A2ALane;
    negativeControl: A2ALane;
    caveatHashesDifferByLane: boolean;
    oneShotSend: boolean;
    x402Settlement: boolean;
    mainnetSend: boolean;
  };
};

type A2ALane = {
  status: string;
  lane: string;
  publicClaimAllowed: boolean;
  delegationChainLength: number;
  relayerTargetMatches: boolean;
  lanePolicySummary: {
    agent: string;
    purpose: string;
    maxAmountAtoms: string;
  } | null;
};

const initialProof = {loading: false, error: "", data: null};

export function RequesterAgentClient() {
  const [need, setNeed] = useState("asthma inhaler refill");
  const [requestedAmountUsd, setRequestedAmountUsd] = useState("25.00");
  const [venice, setVenice] = useState<ProofState<VeniceVerifyProof>>(initialProof);
  const [x402, setX402] = useState<ProofState<X402ShadowProof>>(initialProof);
  const [a2a, setA2A] = useState<ProofState<A2AProof>>(initialProof);

  const latestMessage = useMemo(() => {
    if (venice.data?.report?.requesterMessage) {
      return venice.data.report.requesterMessage;
    }

    if (venice.data?.report?.issues?.length) {
      return "Verifier is blocked. Check the proof issues before making any grant decision.";
    }

    return "Run live Venice verification to produce the requester-facing agent response.";
  }, [venice.data]);

  async function runVeniceVerifier() {
    await runProof(setVenice, "/api/venice/verify", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({need, requestedAmountUsd}),
    });
  }

  async function runX402Shadow() {
    await runProof(setX402, "/api/venice/x402-shadow", {method: "POST"});
  }

  async function runA2AProof() {
    await runProof(setA2A, "/api/a2a/proof", {method: "GET"});
  }

  return (
    <section className="request-demo" aria-label="Requester agent demo">
      <div className="request-layout">
        <section className="request-intake" aria-labelledby="request-intake-title">
          <div>
            <div className="section-kicker">Requester intake</div>
            <h2 id="request-intake-title">Synthetic receipt, live verifier.</h2>
          </div>

          <label>
            Need
            <input value={need} onChange={(event) => setNeed(event.target.value)} />
          </label>

          <label>
            Requested amount
            <input value={requestedAmountUsd} onChange={(event) => setRequestedAmountUsd(event.target.value)} />
          </label>

          <article className="receipt-preview" aria-label="Synthetic receipt preview">
            <span>HALO COMMUNITY PHARMACY</span>
            <strong>Asthma inhaler refill</strong>
            <dl>
              <div>
                <dt>Category</dt>
                <dd>Medicine</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>2026-06-11</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>$25.00</dd>
              </div>
            </dl>
            <p>Synthetic local receipt for the live verifier demo.</p>
          </article>
        </section>

        <section className="agent-response" aria-labelledby="agent-response-title">
          <div>
            <div className="section-kicker">Halo agent</div>
            <h2 id="agent-response-title">Requester-facing response.</h2>
          </div>
          <div className="agent-message">
            <p>{latestMessage}</p>
          </div>
          <div className="action-row">
            <button className="primary-button" type="button" onClick={runVeniceVerifier} disabled={venice.loading}>
              {venice.loading ? "Running Venice..." : "Run live Venice verifier"}
            </button>
            <button className={x402.data ? "primary-button" : "secondary-button"} type="button" onClick={runX402Shadow} disabled={x402.loading}>
              {x402.loading ? "Capturing..." : "Capture x402 boundary"}
            </button>
            <button className={a2a.data ? "primary-button" : "secondary-button"} type="button" onClick={runA2AProof} disabled={a2a.loading}>
              {a2a.loading ? "Loading..." : "Show A2A proof"}
            </button>
          </div>
        </section>
      </div>

      <section className="proof-card-grid" aria-label="Agent proof cards">
        <VeniceProofCard proof={venice} />
        <X402ProofCard proof={x402} />
        <A2AProofCard proof={a2a} />
      </section>
    </section>
  );
}

function VeniceProofCard({proof}: {proof: ProofState<VeniceVerifyProof>}) {
  const report = proof.data?.report;
  const decision = report?.decision;
  const parsed = report?.parsedResult;

  return (
    <article className={`proof-card ${proof.data?.ok ? "verified" : ""}`}>
      <ProofCardHeader label="Step 21" status={report?.status ?? proofStatus(proof)} />
      <h3>Live Venice verifier</h3>
      <p>Live AI reasoning with Bearer credits. No x402 settlement and no paid claim.</p>
      <dl className="proof-facts">
        <Fact label="HTTP" value={report?.responseStatus ? String(report.responseStatus) : "--"} />
        <Fact label="Decision" value={decision ? (decision.approved ? "approved" : "rejected") : "--"} badge />
        <Fact label="Category" value={parsed?.category ?? "--"} />
        <Fact label="Receipt hash" value={proof.data?.request?.receiptHash ?? "--"} code />
      </dl>
      <IssueList issues={proof.error ? [proof.error] : report?.issues ?? []} />
    </article>
  );
}

function X402ProofCard({proof}: {proof: ProofState<X402ShadowProof>}) {
  const summary = proof.data?.summary;
  const offer = summary?.selectedOffer;

  return (
    <article className={`proof-card ${proof.data?.ok ? "captured" : ""}`}>
      <ProofCardHeader label="Step 22" status={summary?.status ?? proofStatus(proof)} />
      <h3>Venice x402 shadow</h3>
      <p>Discovery call only. No payment header, no USDC spend, no settlement claim.</p>
      <dl className="proof-facts">
        <Fact label="HTTP" value={summary?.responseStatus ? String(summary.responseStatus) : "--"} />
        <Fact label="Requirement" value={summary?.paymentRequirementCaptured ? "captured" : "--"} />
        <Fact label="Network" value={offer?.network ?? "--"} />
        <Fact label="Amount atoms" value={offer?.amountAtoms ?? "--"} code />
        <Fact label="payTo hash" value={offer?.payToHash ?? "--"} code />
      </dl>
      <IssueList issues={proof.error ? [proof.error] : summary?.issues ?? []} />
    </article>
  );
}

function A2AProofCard({proof}: {proof: ProofState<A2AProof>}) {
  const summary = proof.data?.summary;

  return (
    <article className={`proof-card ${proof.data?.ok ? "proof-ready" : ""}`}>
      <ProofCardHeader label="Step 23" status={summary?.status ?? proofStatus(proof)} />
      <h3>A2A redelegation</h3>
      <p>Local deterministic proof. Direct one-hop delegation is rejected for A2A wording.</p>
      <dl className="proof-facts">
        <Fact label="Verifier chain" value={formatLane(summary?.verifierLane)} />
        <Fact label="Treasurer chain" value={formatLane(summary?.treasurerLane)} />
        <Fact label="Direct control" value={summary?.negativeControl?.status ?? "--"} />
        <Fact label="Caveats differ" value={summary?.caveatHashesDifferByLane ? "yes" : "--"} />
      </dl>
      <IssueList issues={proof.error ? [proof.error] : []} />
    </article>
  );
}

function formatProofStatus(status: string) {
  if (status.startsWith("CONDITIONAL_GO")) return "CONDITIONAL GO";
  if (status.startsWith("NO_GO")) return "NO GO";
  return status;
}

function ProofCardHeader({label, status}: {label: string; status: string}) {
  return (
    <div className="proof-card-header">
      <span>{label}</span>
      <strong>{formatProofStatus(status)}</strong>
    </div>
  );
}

function Fact({label, value, code = false, badge = false}: {label: string; value: string; code?: boolean; badge?: boolean}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {code ? (
          <code>{value}</code>
        ) : badge ? (
          <span className={`status-badge ${value === "approved" ? "approved" : value === "rejected" ? "rejected" : ""}`}>
            {value}
          </span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function IssueList({issues}: {issues: string[]}) {
  const cleaned = issues.filter(Boolean);
  if (cleaned.length === 0) {
    return <p className="proof-ok">No issues recorded for this proof boundary.</p>;
  }

  return (
    <ul className="proof-issues">
      {cleaned.map((issue) => (
        <li key={issue}>{issue}</li>
      ))}
    </ul>
  );
}

function proofStatus<T>(proof: ProofState<T>) {
  if (proof.loading) {
    return "RUNNING";
  }
  if (proof.error) {
    return "NO-GO";
  }
  return "NOT RUN";
}

function formatLane(lane?: A2ALane) {
  if (!lane) {
    return "--";
  }

  return `${lane.delegationChainLength} hops / ${lane.publicClaimAllowed ? "ready" : "blocked"}`;
}

async function runProof<T>(
  setProof: (proof: ProofState<T>) => void,
  url: string,
  init: RequestInit,
) {
  setProof({loading: true, error: "", data: null});

  try {
    const response = await fetch(url, {...init, cache: "no-store"});
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || `${url} returned HTTP ${response.status}`);
    }

    setProof({loading: false, error: "", data: payload});
  } catch (error) {
    setProof({
      loading: false,
      error: error instanceof Error ? error.message : String(error),
      data: null,
    });
  }
}
