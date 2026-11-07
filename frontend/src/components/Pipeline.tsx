import { useState } from "react";

const FIRST_SHOWN = 3;

export interface PipelineItem {
  id: string;
  title: string;
  subtitle: string;
  metric: string;
  message: string;
  quote: string;
}

/** One stage at a time, with the draft ready in the card. An item with no saved stage is in the first one. */
export function Pipeline({
  stages,
  moves,
  items,
  placement,
  onMove,
}: {
  stages: string[];
  /** The button that moves an item out of each stage. */
  moves: string[];
  items: PipelineItem[];
  placement: Record<string, number>;
  onMove: (id: string, stage: number) => void;
}) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const stageOf = (item: PipelineItem) => placement[item.id] ?? 0;
  const shown = items.filter((item) => stageOf(item) === active);
  const last = stages.length - 1;
  const visible = showAll ? shown : shown.slice(0, FIRST_SHOWN);

  async function copy(item: PipelineItem) {
    await navigator.clipboard.writeText(item.message);
    setCopied(item.id);
  }

  return (
    <>
      <div className="stages" role="tablist" aria-label="Stages">
        {stages.map((stage, index) => (
          <button
            key={stage}
            type="button"
            role="tab"
            aria-selected={index === active}
            className={index === active ? "active" : undefined}
            onClick={() => {
              setActive(index);
              setShowAll(false);
            }}
          >
            <strong>{items.filter((item) => stageOf(item) === index).length}</strong>
            {stage}
          </button>
        ))}
      </div>
      <div className="desk-panel" role="tabpanel">
        {shown.length === 0 && <p className="desk-empty">Nothing in {stages[active]} yet.</p>}
        {visible.map((item) => (
          <article key={item.id} className="idea">
            <div className="idea-head">
              <div>
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
              </div>
              <strong>{item.metric}</strong>
            </div>
            {active === 0 ? <p className="idea-draft">{item.message.replace(/\n\n/g, "\n")}</p> : <p className="idea-quote">“{item.quote}”</p>}
            <div className="idea-actions">
              {active === 0 && (
                <button type="button" className="pill pill-small" onClick={() => copy(item)}>
                  {copied === item.id ? "Copied" : "Copy"}
                </button>
              )}
              {active < last && (
                <button
                  type="button"
                  className={active === 0 ? "pill pill-small pill-soft" : "pill pill-small"}
                  onClick={() => onMove(item.id, active + 1)}
                >
                  {moves[active]}
                </button>
              )}
              {active > 0 && (
                <button type="button" className="pill pill-small pill-soft" onClick={() => onMove(item.id, active - 1)}>
                  Undo
                </button>
              )}
            </div>
          </article>
        ))}
        {visible.length < shown.length && (
          <button type="button" className="idea-more" onClick={() => setShowAll(true)}>
            Show all {shown.length}
          </button>
        )}
      </div>
    </>
  );
}
