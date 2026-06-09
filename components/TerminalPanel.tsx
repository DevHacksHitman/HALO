export function TerminalPanel({title, lines}: {title: string; lines: string[]}) {
  return (
    <section className="terminal" aria-labelledby={`${slug(title)}-title`}>
      <div className="terminal-header">
        <span id={`${slug(title)}-title`}>{title}</span>
        <span>local</span>
      </div>
      <pre aria-live="polite">
        {lines.map((line) => (
          <code key={line}>{line}</code>
        ))}
      </pre>
    </section>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
