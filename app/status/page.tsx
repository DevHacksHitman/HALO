import {TerminalPanel} from "@/components/TerminalPanel";
import {statusCards, statusTerminalLines} from "@/lib/uiData";

export default function StatusPage() {
  return (
    <main className="page-grid">
      <section className="main-panel" aria-labelledby="status-title">
        <div className="section-kicker">Status console</div>
        <h1 id="status-title">Webhook-ready grant status tracking.</h1>
        <p className="lede">
          Step 8 turns relayer callbacks into append-only grant events so the demo can show
          verification, relay progress, and payout status without pooled custody.
        </p>

        <section className="status-grid" aria-label="Grant status preview">
          {statusCards.map((card) => (
            <article key={card.title} className={`status-card ${card.state.toLowerCase()}`}>
              <span>{card.state}</span>
              <h2>{card.title}</h2>
              <p>{card.detail}</p>
              <code>{card.taskId}</code>
            </article>
          ))}
        </section>
      </section>

      <aside className="side-panel" aria-label="Webhook terminal preview">
        <TerminalPanel title="Webhook Flow Logs" lines={statusTerminalLines} />
      </aside>
    </main>
  );
}
