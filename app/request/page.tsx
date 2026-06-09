import {TerminalPanel} from "@/components/TerminalPanel";
import {requestTerminalLines} from "@/lib/uiData";

const messages = [
  {from: "halo", text: "What urgent need can the community help with today?"},
  {from: "user", text: "I need help covering a $25 inhaler refill."},
  {from: "halo", text: "Upload the receipt or pharmacy notice and I will verify it privately."},
  {from: "user", text: "Receipt uploaded. Amount is $25.00."},
  {from: "halo", text: "Verification and payout routing are queued for the next integration step."},
];

export default function RequestPage() {
  return (
    <main className="page-grid">
      <section className="main-panel" aria-labelledby="request-title">
        <div className="section-kicker">Requester console</div>
        <h1 id="request-title">A clear request flow for urgent help.</h1>
        <p className="lede">
          This shell keeps requester UX easy to navigate for non-technical users while the backend prepares Venice,
          x402 and 1Shot activity behind the scenes.
        </p>

        <section className="chat-surface" aria-label="Requester chat preview">
          {messages.map((message, index) => (
            <div key={`${message.from}-${index}`} className={`chat-row ${message.from}`}>
              <p>{message.text}</p>
            </div>
          ))}
          <form className="chat-input" aria-label="Request input preview">
            <input value="Next step: wire image upload and Venice verification" readOnly />
            <button type="button" aria-label="Attach receipt">
              +
            </button>
          </form>
        </section>
      </section>

      <aside className="side-panel" aria-label="Requester terminal preview">
        <TerminalPanel title="Requester Flow Logs" lines={requestTerminalLines} />
      </aside>
    </main>
  );
}

