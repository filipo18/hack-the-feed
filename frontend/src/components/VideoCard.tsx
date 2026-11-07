import { useState } from "react";
import { compact } from "../lib/format";
import type { CardItem } from "../lib/view";
import { Highlight } from "./Highlight";

export function VideoCard({ index, item, action, onAction }: { index: number; item: CardItem; action: string; onAction: () => void }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = item.thumbnail && failedImage !== item.thumbnail ? item.thumbnail : null;
  const tileClass = `tile tile-${index % 5} card-tile`;
  const tile = (
    <>
      {image ? (
        <img src={image} alt={`Video frame from ${item.title}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedImage(image)} />
      ) : (
        <span className="card-preview-fallback" aria-hidden="true"><span>▶</span>Preview unavailable</span>
      )}
      <span className="card-rank">{index + 1}</span>
      <span className="card-views">{item.views === null ? "Views unknown" : `${compact(item.views)} ${item.unit}`}</span>
      <span className="card-quote">
        <span className="card-excerpt" dir="auto">“<Highlight text={item.quote} term={item.highlight} />”</span>
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
        </div>
        <p className="card-amount">
          {item.amount}
          {item.amountNote && <small>{item.amountNote}</small>}
        </p>
      </div>
      {item.reason && (
        <details className="card-evidence">
          <summary>Why this creator</summary>
          <p>{item.reason}</p>
        </details>
      )}
      <button type="button" className="pill pill-primary" aria-label={`${action}: ${item.title}`} onClick={onAction}>
        {action}
      </button>
    </article>
  );
}
