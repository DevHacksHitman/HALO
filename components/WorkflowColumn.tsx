type WorkflowColumnProps = {
  column: {
    title: string;
    items: string[];
  };
};

export function WorkflowColumn({column}: WorkflowColumnProps) {
  return (
    <article className="workflow-column">
      <h2>{column.title}</h2>
      <ul>
        {column.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

