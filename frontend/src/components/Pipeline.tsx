export interface PipelineItem {
  id: string;
  title: string;
  detail: string;
  value: string;
}

/** Stages are left to right. An item with no saved stage sits in the first one. */
export function Pipeline({
  stages,
  items,
  placement,
  onMove,
}: {
  stages: string[];
  items: PipelineItem[];
  placement: Record<string, number>;
  onMove: (id: string, stage: number) => void;
}) {
  return (
    <div className="board">
      {stages.map((stage, stageIndex) => {
        const cards = items.filter((item) => (placement[item.id] ?? 0) === stageIndex);
        return (
          <section key={stage} className="board-column" aria-label={stage}>
            <h2>
              {stage} <span>{cards.length}</span>
            </h2>
            {cards.map((item) => (
              <article key={item.id} className="board-card">
                <strong>{item.title}</strong>
                <span className="sub">{item.detail}</span>
                <p className="board-value">{item.value}</p>
                <div className="board-moves">
                  {stageIndex > 0 && (
                    <button type="button" onClick={() => onMove(item.id, stageIndex - 1)}>
                      Back
                    </button>
                  )}
                  {stageIndex < stages.length - 1 && (
                    <button type="button" onClick={() => onMove(item.id, stageIndex + 1)}>
                      Move to {stages[stageIndex + 1]}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
