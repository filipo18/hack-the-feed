import { useEffect, useState } from "react";
import { Highlight } from "./Highlight";

const STAGE_MS = 560;
const SETTLE_MS = 420;
const SKELETONS = [0, 1, 2, 3, 4, 5];

export interface ScanItem {
  text: string;
  term: string;
  thumbnail?: string | null;
}

/** Plays between search and results. It also holds the screen while a live search runs. */
export function Scan({
  title,
  stages,
  items,
  ready,
  onDone,
}: {
  title: string;
  stages: string[];
  items: ScanItem[];
  ready: boolean;
  onDone: () => void;
}) {
  const [stage, setStage] = useState(0);
  const [waited, setWaited] = useState(false);
  const last = stages.length - 1;

  useEffect(() => {
    if (stage >= last) return;
    const timer = setTimeout(() => setStage(stage + 1), STAGE_MS);
    return () => clearTimeout(timer);
  }, [stage, last]);

  useEffect(() => {
    if (stage < last) return;
    if (!ready) {
      const timer = setTimeout(() => setWaited(true), 2500);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(onDone, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [stage, last, ready, onDone]);

  const reel = items.length > 0 ? [...items, ...items, ...items, ...items].slice(0, 12) : [];

  return (
    <div className="scan" role="status">
      <div className="scan-reel" aria-hidden="true">
        <div className="scan-track">
          {reel.length > 0
            ? [...reel, ...reel].map((item, index) => (
                <div key={index} className={`tile tile-${index % 5} scan-tile`}>
                  {item.thumbnail && <img src={item.thumbnail} alt="" onError={(event) => event.currentTarget.remove()} />}
                  <p>
                    “<Highlight text={item.text} term={item.term} />”
                  </p>
                </div>
              ))
            : [...SKELETONS, ...SKELETONS].map((item, index) => (
                <div key={index} className={`tile tile-${item % 5} scan-tile`}>
                  <span className="scan-bar" />
                  <span className="scan-bar scan-bar-short" />
                </div>
              ))}
        </div>
        <span className="scan-beam" />
      </div>
      <p className={title.startsWith("@") ? "display scan-title scan-keep" : "display scan-title"} aria-hidden="true">
        {title}
      </p>
      <p className="scan-stage" key={stage}>
        {waited ? "Still reading. Live searches can take a few seconds." : stages[stage]}
      </p>
      <ol className="scan-steps" aria-hidden="true">
        {stages.map((name, index) => (
          <li key={name} className={index <= stage ? "done" : undefined} />
        ))}
      </ol>
      {ready && (
        <button type="button" className="scan-skip" onClick={onDone}>
          Skip
        </button>
      )}
    </div>
  );
}
