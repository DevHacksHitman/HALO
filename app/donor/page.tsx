import {DonorPermissionClient} from "@/components/DonorPermissionClient";
import {TerminalPanel} from "@/components/TerminalPanel";
import {donorSteps, donorTerminalLines} from "@/lib/uiData";

export default function DonorPage() {
  return (
    <main className="page-grid">
      <section className="main-panel" aria-labelledby="donor-title">
        <div className="section-kicker">Donor console</div>
        <h1 id="donor-title">Sponsor a scoped monthly allowance.</h1>
        <p className="lede">
          Connect MetaMask, fetch the 1Shot relayer target, request a scoped Advanced Permission,
          then watch the agent path stay inside explicit caps.
        </p>

        <div className="control-surface">
          <div className="metric">
            <span>Monthly cap</span>
            <strong>$100 USDC</strong>
          </div>
          <div className="metric">
            <span>Per-grant cap</span>
            <strong>$30 USDC</strong>
          </div>
          <div className="metric">
            <span>API budget</span>
            <strong>$2 USDC</strong>
          </div>
        </div>

        <DonorPermissionClient />

        <section className="timeline" aria-label="Donor flow steps">
          {donorSteps.map((step, index) => (
            <article key={step.title} className="timeline-item">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.copy}</p>
              </div>
            </article>
          ))}
        </section>
      </section>

      <aside className="side-panel status-help-panel" aria-label="Donor terminal preview">
        <section className="status-explainer">
          <span>Judge proof</span>
          <h2>MetaMask track.</h2>
          <ul>
            <li>Donor uses <strong>Advanced Permissions</strong> to grant an allowance.</li>
            <li>Wallet is touched once, sub-agents handle execution.</li>
            <li>Permissions strictly scoped to monthly and per-grant caps.</li>
          </ul>
        </section>

        <section className="status-explainer reviewer-note">
          <span>Boundary</span>
          <h2>Allowance only.</h2>
          <p>
            No funds are moved during this step. The donor merely delegates
            conditional authority to the Master Almoner smart account.
          </p>
        </section>

        <TerminalPanel title="Donor Flow Logs" lines={donorTerminalLines} />
      </aside>
    </main>
  );
}
