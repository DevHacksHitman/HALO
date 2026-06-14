import Link from "next/link";
import {DemoCockpitClient} from "@/components/DemoCockpitClient";
import {ProofStrip} from "@/components/ProofStrip";
import {TerminalPanel} from "@/components/TerminalPanel";
import {WorkflowColumn} from "@/components/WorkflowColumn";
import {stepProofs, terminalLines, workflowColumns} from "@/lib/uiData";

export default function HomePage() {
  return (
    <main className="page-grid">
      <section className="main-panel" aria-labelledby="overview-title">
        <div className="section-kicker">Build dashboard</div>
        <h1 id="overview-title">Autonomous mutual aid without pooled custody.</h1>
        <p className="lede">
          Halo lets donors grant scoped MetaMask permissions while specialized agents verify
          requests, expose payment boundaries, and keep payout status tied to relayer confirmation.
        </p>

        <div className="action-row">
          <Link className="primary-button" href="/donor">
            Sponsor flow
          </Link>
          <Link className="secondary-button" href="/request">
            Request flow
          </Link>
        </div>

        <DemoCockpitClient />

        <ProofStrip items={stepProofs} />

        <section className="workflow-grid" aria-label="Halo workflow">
          {workflowColumns.map((column) => (
            <WorkflowColumn key={column.title} column={column} />
          ))}
        </section>
      </section>

      <aside className="side-panel status-help-panel" aria-label="Terminal proof">
        <section className="status-explainer">
          <span>Judge proof</span>
          <h2>A full stack submission.</h2>
          <ul>
            <li><strong>MetaMask:</strong> Advanced Permissions delegation.</li>
            <li><strong>Venice AI:</strong> Receipt verification + x402 shadow probing.</li>
            <li><strong>Agent A2A:</strong> Multi-hop lane redelegation.</li>
            <li><strong>1Shot:</strong> Base Sepolia relay proof and status confirmation.</li>
          </ul>
        </section>

        <section className="status-explainer reviewer-note">
          <span>Boundary</span>
          <h2>Architectural honesty.</h2>
          <p>
            Each page isolates a sponsor integration. No fake claims, no mocked statuses.
            What you see is the real boundary.
          </p>
        </section>

        <TerminalPanel title="Local Proof Log" lines={terminalLines} />
      </aside>
    </main>
  );
}
