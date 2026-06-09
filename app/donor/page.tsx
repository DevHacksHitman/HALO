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
          This shell previews the donor journey before wallet integration: connect, upgrade, sign
          Advanced Permission, then watch scoped agent activity.
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

      <aside className="side-panel" aria-label="Donor terminal preview">
        <TerminalPanel title="Donor Flow Logs" lines={donorTerminalLines} />
      </aside>
    </main>
  );
}
