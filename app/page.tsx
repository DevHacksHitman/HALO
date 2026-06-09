import Link from "next/link";
import {ProofStrip} from "@/components/ProofStrip";
import {TerminalPanel} from "@/components/TerminalPanel";
import {WorkflowColumn} from "@/components/WorkflowColumn";
import {grantFeed, stepProofs, terminalLines, workflowColumns} from "@/lib/uiData";

export default function HomePage() {
  return (
    <main className="page-grid">
      <section className="main-panel" aria-labelledby="overview-title">
        <div className="section-kicker">Build dashboard</div>
        <h1 id="overview-title">Programmable mutual aid without pooled custody.</h1>
        <p className="lede">
          Halo lets donors grant scoped MetaMask permissions while specialized agents verify requests
          and prepare USDC transfers through the 1Shot execution path.
        </p>

        <div className="action-row">
          <Link className="primary-button" href="/donor">
            Sponsor flow
          </Link>
          <Link className="secondary-button" href="/request">
            Request flow
          </Link>
        </div>

        <ProofStrip items={stepProofs} />

        <section className="workflow-grid" aria-label="Halo workflow">
          {workflowColumns.map((column) => (
            <WorkflowColumn key={column.title} column={column} />
          ))}
        </section>

        <section className="feed-section" aria-labelledby="feed-title">
          <div>
            <div className="section-kicker">Community feed preview</div>
            <h2 id="feed-title">Grant status copy for the final demo.</h2>
          </div>
          <div className="feed-list">
            {grantFeed.map((item) => (
              <article key={item.title} className="feed-item">
                <span>{item.amount}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <aside className="side-panel" aria-label="Terminal proof">
        <TerminalPanel title="Local Proof Log" lines={terminalLines} />
      </aside>
    </main>
  );
}

