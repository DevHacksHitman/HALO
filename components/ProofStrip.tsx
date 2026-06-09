type ProofItem = {
  label: string;
  value: string;
  detail: string;
};

export function ProofStrip({items}: {items: ProofItem[]}) {
  return (
    <section className="proof-strip" aria-label="Build proof summary">
      {items.map((item) => (
        <article key={item.label} className="proof-item">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.detail}</p>
        </article>
      ))}
    </section>
  );
}

