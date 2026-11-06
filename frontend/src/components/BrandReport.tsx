import { useState } from "react";
import { OutreachDialog, type OutreachDraft } from "./OutreachDialog";
import type { SearchCreator, SearchResponse } from "../lib/contract";
import { renderableCreators } from "../lib/contract";
import {
  HONESTY_NOTE,
  assessmentCopy,
  disclosureLabel,
  draftNote,
  evidenceExcerpt,
  evidenceLabels,
  formatViews,
  holdoutLabel,
  knownViewTotal,
  modelLabel,
} from "../lib/present";

export function BrandReport({
  data,
  demoLabel,
  allowDraft = true,
}: {
  data: SearchResponse;
  demoLabel?: string;
  allowDraft?: boolean;
}) {
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const ranked = renderableCreators(data.rankedCreators);
  const held = renderableCreators(data.heldOut);
  const pending = renderableCreators(data.unassessedCreators);
  const skipped = ranked.skipped + held.skipped + pending.skipped;
  const copy = assessmentCopy(data.assessmentReason);
  const views = knownViewTotal(ranked.creators);

  return (
    <div data-testid="brand-report">
      {demoLabel && (
        <p className="banner-block" data-testid="demo-banner">
          <strong>{demoLabel}</strong>
          <span>These cards are a checked-in fixture. They did not come from Oriane or GMI.</span>
        </p>
      )}
      <p className="results-meta" data-testid="search-meta">
        Instagram and TikTok, one page of 10 on each channel. {modelLabel(data)} {HONESTY_NOTE}
      </p>
      {copy && (
        <div className="result-note" data-testid="assessment" role="status">
          <p>
            <strong>{copy.title}</strong>
          </p>
          <p>{copy.text}</p>
        </div>
      )}
      {data.warnings.length > 0 && (
        <ul className="status-list" data-testid="warnings">
          {data.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {skipped > 0 && (
        <p className="result-note" role="status">
          {skipped} creator {skipped === 1 ? "row was" : "rows were"} skipped because{" "}
          {skipped === 1 ? "it had" : "they had"} no creatorKey.
        </p>
      )}
      <dl className="app-totals">
        <div>
          <dt>Ranked creators</dt>
          <dd>{ranked.creators.length}</dd>
        </div>
        <div>
          <dt>Relevant post views</dt>
          <dd>{views.text}</dd>
        </div>
        <div>
          <dt>Not ranked</dt>
          <dd>
            {held.creators.length} held out, {pending.creators.length} unassessed
          </dd>
        </div>
      </dl>
      {ranked.creators.length > 0 && (
        <table className="rank" data-testid="ranked-creators">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Creator</th>
              <th scope="col">Why</th>
              <th scope="col" className="num">
                Views
              </th>
              <th scope="col">
                <span className="visually-hidden">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.creators.map((creator, index) => (
              <CreatorRow
                key={creator.creatorKey}
                creator={creator}
                index={index}
                onDraft={
                  allowDraft
                    ? () => setDraft(draftNote(data.brand, creator))
                    : undefined
                }
              />
            ))}
          </tbody>
        </table>
      )}
      {ranked.creators.length === 0 && !copy && (
        <p className="result-note" role="status">
          No creator was ranked in this sample.
        </p>
      )}
      {held.creators.length > 0 && (
        <section data-testid="held-out">
          <h2 className="app-heading">Held out</h2>
          <ul className="status-list">
            {held.creators.map((creator) => (
              <li key={creator.creatorKey}>
                <strong>{creator.handle ? `@${creator.handle}` : creator.creatorKey}</strong>
                <span className="sub">
                  {creator.platform} · {holdoutLabel(creator.holdoutReason)} · {disclosureLabel(creator.disclosure)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pending.creators.length > 0 && (
        <section data-testid="unassessed">
          <h2 className="app-heading">Unassessed</h2>
          <p className="results-meta">Not judged. These rows are not a ranking and not a rejection.</p>
          <ul className="status-list">
            {pending.creators.map((creator) => (
              <li key={creator.creatorKey}>
                <strong>{creator.handle ? `@${creator.handle}` : creator.creatorKey}</strong>
                <span className="sub">
                  {creator.platform} · {creator.judgmentSource || "pending"} · {disclosureLabel(creator.disclosure)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {allowDraft && <OutreachDialog draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}

function CreatorRow({
  creator,
  index,
  onDraft,
}: {
  creator: SearchCreator;
  index: number;
  onDraft?: () => void;
}) {
  const labels = evidenceLabels(creator);
  const excerpt = evidenceExcerpt(creator);
  return (
    <tr>
      <td className="rank-number" data-label="Rank">
        {index + 1}
      </td>
      <td data-label="Creator">
        <strong>{creator.handle ? `@${creator.handle}` : creator.creatorKey}</strong>
        <span className="sub">
          {creator.platform || "platform unknown"} · {disclosureLabel(creator.disclosure)}
        </span>
      </td>
      <td data-label="Why">
        {creator.why?.trim() || "No explanation was returned."}
        <span className="sub">
          {labels.length > 0 ? labels.join(", ") : "No evidence label"}
          {excerpt ? ` · “${excerpt}”` : ""}
        </span>
      </td>
      <td className="num" data-label="Views">
        <strong>{formatViews(creator.sumViews, creator.viewsIncomplete)}</strong>
        <span className="sub">
          {creator.relevantPostCount ?? 0} relevant {(creator.relevantPostCount ?? 0) === 1 ? "post" : "posts"}
        </span>
      </td>
      <td className="action">
        {onDraft && (
          <button type="button" className="pill pill-primary" onClick={onDraft}>
            Draft a note
          </button>
        )}
      </td>
    </tr>
  );
}
