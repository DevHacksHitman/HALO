import {RequesterAgentClient} from "@/components/RequesterAgentClient";
import {TerminalPanel} from "@/components/TerminalPanel";
import {requestTerminalLines} from "@/lib/uiData";

export default function RequestPage() {
  return (
    <main className="page-grid">
      <section className="main-panel" aria-labelledby="request-title">
        <div className="section-kicker">Requester console</div>
        <h1 id="request-title">A live verifier flow for urgent help.</h1>
        <p className="lede">
          The requester enters a need, Halo runs the Venice verifier from the app, then shows
          x402 and A2A proof boundaries without triggering a live 1Shot send.
        </p>

        <RequesterAgentClient />
      </section>

      <aside className="side-panel status-help-panel" aria-label="Requester terminal preview">
        <section className="status-explainer">
          <span>Judge proof</span>
          <h2>Venice & A2A tracks.</h2>
          <ul>
            <li><strong>Venice AI</strong> parses the receipt securely.</li>
            <li><strong>A2A coordination:</strong> Permissions are redelegated through Verifier & Treasurer lanes.</li>
            <li>x402 payment requirements are discovered dynamically.</li>
          </ul>
        </section>

        <section className="status-explainer reviewer-note">
          <span>Boundary</span>
          <h2>Shadow discovery only.</h2>
          <p>
            No live payment header, no USDC spend, no 1Shot send yet. 
            This boundary proves readiness before execution.
          </p>
        </section>

        <TerminalPanel title="Requester Flow Logs" lines={requestTerminalLines} />
      </aside>
    </main>
  );
}
