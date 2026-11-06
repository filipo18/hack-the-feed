import { CHANNEL_LABEL, compact } from "../lib/format";
import type { Mention } from "../lib/types";
import { Highlight } from "./Highlight";

export function VideoCard({
  index,
  mention,
  title,
  subtitle,
  amount,
  amountNote,
  unit,
  action,
  actionLabel,
  onAction,
}: {
  index: number;
  mention: Mention;
  title: string;
  subtitle: string;
  amount: string;
  amountNote?: string;
  unit: string;
  action: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const where = mention.channels.map((channel) => CHANNEL_LABEL[channel]).join(", ");

  return (
    <article className="card" style={{ animationDelay: `${index * 70}ms` }}>
      <a className={`tile tile-${index % 5} card-tile`} href={mention.postUrl} target="_blank" rel="noreferrer">
        {mention.thumbnail && <img src={mention.thumbnail} alt="" />}
        <span className="card-rank">{index + 1}</span>
        <span className="card-views">{mention.views === null ? `${unit} unknown` : `${compact(mention.views)} ${unit}`}</span>
        <span className="card-quote">
          “<Highlight text={mention.snippet} term={mention.brand} />”
          <small>
            {where}
            {mention.timestamp && ` at ${mention.timestamp}`}
          </small>
        </span>
      </a>
      <div className="card-body">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <p className="card-amount">
          {amount}
          {amountNote && <small>{amountNote}</small>}
        </p>
      </div>
      <button type="button" className="pill pill-primary" aria-label={actionLabel} onClick={onAction}>
        {action}
      </button>
    </article>
  );
}
