import { compact } from "../lib/format";
import type { CardItem } from "../lib/view";
import { Highlight } from "./Highlight";

export function VideoCard({ index, item, action, onAction }: { index: number; item: CardItem; action: string; onAction: () => void }) {
  const tileClass = `tile tile-${index % 5} card-tile`;
  const tile = (
    <>
      {item.thumbnail && <img src={item.thumbnail} alt="" onError={(event) => event.currentTarget.remove()} />}
      <span className="card-rank">{index + 1}</span>
      <span className="card-views">{item.views === null ? "Views unknown" : `${compact(item.views)} ${item.unit}`}</span>
      <span className="card-quote">
        “<Highlight text={item.quote} term={item.highlight} />”
        <small>{item.where}</small>
      </span>
    </>
  );

  return (
    <article className="card" style={{ animationDelay: `${index * 70}ms` }}>
      {item.postUrl ? (
        <a className={tileClass} href={item.postUrl} target="_blank" rel="noreferrer">
          {tile}
        </a>
      ) : (
        <div className={tileClass}>{tile}</div>
      )}
      <div className="card-body">
        <div>
          <h3>{item.title}</h3>
          <p>{item.subtitle}</p>
          {item.reason && <p className="card-reason">{item.reason}</p>}
        </div>
        <p className="card-amount">
          {item.amount}
          {item.amountNote && <small>{item.amountNote}</small>}
        </p>
      </div>
      <button type="button" className="pill pill-primary" aria-label={`${action}: ${item.title}`} onClick={onAction}>
        {action}
      </button>
    </article>
  );
}
