import {GrantStatusClient} from "@/components/GrantStatusClient";

export default function StatusPage() {
  return (
    <main className="page-grid">
      <section className="main-panel" aria-labelledby="status-title">
        <div className="section-kicker">Status proof</div>
        <h1 id="status-title">1Shot-confirmed grant status.</h1>
        <p className="lede">
          Halo marks a grant paid only after <code>relayer_getStatus=200</code> or a signed
          1Shot webhook. This page reads real grant data from <code>/api/grants</code>,
          no sample paid cards are rendered.
        </p>

        <GrantStatusClient />
      </section>

      <aside className="side-panel status-help-panel" aria-label="How status works">
        <section className="status-explainer">
          <span>Judge proof</span>
          <h2>No guesswork.</h2>
          <ul>
            <li>1Shot status is normalized into Halo grant state.</li>
            <li>Confirmed paid requires relayer_getStatus=200 or a signed webhook.</li>
            <li>Task and transaction references are hashed for recording.</li>
            <li>Upstash makes the status log durable on Vercel.</li>
          </ul>
        </section>

        <section className="status-explainer reviewer-note">
          <span>Boundary</span>
          <h2>Base Sepolia proof.</h2>
          <p>
            Step 20 is the status-confirmed Base Sepolia payout proof. Mainnet
            execution remains strictly locked by the Step 24 preflight boundary.
          </p>
        </section>
      </aside>
    </main>
  );
}
