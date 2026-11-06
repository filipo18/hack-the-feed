import { useState } from "react";
import { OutreachDialog, type OutreachDraft } from "./OutreachDialog";
import { compact, money } from "../lib/format";
import type { CreatorEntity, CreatorReport, ReportPlatform, ReviewDisclosure } from "../lib/types";

const PLATFORMS: ReportPlatform[] = ["instagram", "tiktok", "youtube"];
const BILLABLE = new Set<CreatorEntity["entityType"]>(["brand", "team", "product"]);

type Review = { confirmed: boolean; disclosure: ReviewDisclosure };

export function CreatorReportView({
  report,
  sample,
  platform,
  onPlatform,
  showPipeline,
}: {
  report: CreatorReport;
  sample: boolean;
  platform: ReportPlatform;
  onPlatform: (platform: ReportPlatform) => void;
  showPipeline?: boolean;
}) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const reviewOf = (entity: CreatorEntity): Review =>
    reviews[entity.id] ?? { confirmed: false, disclosure: entity.disclosure };

  const confirmed = report.entities.filter((entity) => reviewOf(entity).confirmed && BILLABLE.has(entity.entityType));
  const cpm = report.illustrativeCpm;

  return (
    <div data-testid="creator-report">
      <div className="filter" role="group" aria-label="Platform">
        {PLATFORMS.map((item) => (
          <button key={item} type="button" className={item === platform ? "active" : undefined} onClick={() => onPlatform(item)}>
            {item}
          </button>
        ))}
      </div>
      <p className="results-meta">
        Indexed {report.retrieval.indexedTotalCount ?? "unknown"} · returned {report.retrieval.returnedCount} of cap{" "}
        {report.retrieval.cap}
        {report.retrieval.earliestPublishedAt &&
          ` · ${report.retrieval.earliestPublishedAt.slice(0, 10)} to ${report.retrieval.latestPublishedAt?.slice(0, 10)}`}
        .{" "}
        {report.retrieval.paginationComplete == null
          ? "Page coverage is unknown"
          : report.retrieval.paginationComplete
            ? "This page covers the indexed count"
            : "This page does not cover the indexed count"}
        . This is not a complete account history.
        {sample && <span className="sample-tag">Sample data</span>}
      </p>
      <Assessment report={report} />
      {report.retrieval.message === "no indexed content found" && (
        <p className="result-note">No indexed content found. This does not mean the account does not exist, and it does not mean there are no brand mentions.</p>
      )}
      {report.posts.length > 0 && report.entities.length === 0 && report.retrieval.message !== "no indexed content found" && (
        <p className="result-note">Posts were returned. No grounded names are ready to review.</p>
      )}
      {!showPipeline && (
        <div className="brand-list">
          {report.entities.map((entity) => {
            const review = reviewOf(entity);
            const amount = review.confirmed ? entityAmount(entity, cpm) : null;
            return (
              <article key={entity.id} className="brand-row">
                <div className="brand-main">
                  <h2>{entity.name}</h2>
                  {amount != null ? <p className="brand-value">{money(amount)}</p> : <p className="brand-value">—</p>}
                  <p className="sub">
                    {labelType(entity.entityType)}
                    {entity.aliases.length > 0 ? ` · also ${entity.aliases.join(", ")}` : ""} · {review.disclosure} ·{" "}
                    {entity.matchingPostCount} {entity.matchingPostCount === 1 ? "post" : "posts"}
                  </p>
                </div>
                <ul className="mention-list">
                  {entity.evidence.map((item, index) => (
                    <li key={`${item.platformId}-${item.field}-${index}`}>
                      <span>{item.snippet ? `“${item.snippet}”` : "No text quote. The frame itself is the evidence."}</span>
                      <span className="sub">
                        {item.field}
                        {item.timestampSeconds != null && ` at ${item.timestampSeconds}s`} · {item.platformId} ·{" "}
                        {item.views == null ? "views unknown" : `${compact(item.views)} views`} · {item.reviewStatus}
                        {item.source === "vision" && " · a logo is not a contract"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="brand-actions">
                  <button
                    type="button"
                    className="pill pill-quiet-dark"
                    onClick={() => setReviews({ ...reviews, [entity.id]: { ...review, confirmed: !review.confirmed } })}
                  >
                    {review.confirmed ? "Confirmed" : "Confirm appearance"}
                  </button>
                  {review.confirmed && BILLABLE.has(entity.entityType) && (
                    <button
                      type="button"
                      className="pill pill-primary"
                      onClick={() => setDraft(pitch(report, entity, review, cpm))}
                    >
                      Copy pitch
                    </button>
                  )}
                  <label className="sub">
                    Status
                    <select
                      value={review.disclosure}
                      onChange={(event) =>
                        setReviews({
                          ...reviews,
                          [entity.id]: { ...review, disclosure: event.target.value as ReviewDisclosure },
                        })
                      }
                    >
                      <option value="unknown">unknown</option>
                      <option value="disclosed">disclosed</option>
                      <option value="paid">paid</option>
                    </select>
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {showPipeline && (
        <ul className="app-rows">
          {confirmed.length === 0 && <li>Confirm an appearance before it can be pitched. Nothing is sent from here.</li>}
          {confirmed.map((entity) => (
            <li key={entity.id}>
              <div>
                <strong>{entity.name}</strong>
                <span className="sub">{labelType(entity.entityType)} · {reviewOf(entity).disclosure}</span>
              </div>
              <div className="app-row-quote">
                {entity.evidence[0]?.snippet ? `“${entity.evidence[0].snippet}”` : "Frame evidence, no text quote."}
              </div>
              <div className="app-row-num">
                <strong>{entityAmount(entity, cpm) == null ? "—" : money(entityAmount(entity, cpm) as number)}</strong>
              </div>
              <button type="button" className="pill pill-primary" onClick={() => setDraft(pitch(report, entity, reviewOf(entity), cpm))}>
                Copy pitch
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirmed.length > 0 && <JokeInvoice report={report} entities={confirmed} reviews={reviews} />}
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function Assessment({ report }: { report: CreatorReport }) {
  const text =
    report.assessment.text === "complete"
      ? null
      : report.assessment.text === "failed"
        ? "Text extraction failed. No substitute list was added."
        : "Text extraction has not run.";
  const vision =
    report.assessment.vision === "complete"
      ? `Vision looked at ${report.visionFramesSent} frame${report.visionFramesSent === 1 ? "" : "s"}. Names stay unreviewed.`
      : report.assessment.vision === "failed"
        ? "Vision failed. No frame names were invented."
        : "Vision was not run. Live vision validation is blocked.";
  return (
    <p className="result-note">
      {report.retrieval.status === "not_configured" && "Oriane is not configured. No posts were requested."}
      {report.retrieval.status === "failed" && (report.retrieval.message ?? "Oriane did not return a page.")}
      {text && ` ${text}`}
      {` ${vision}`}
      {report.illustrativeCpm == null
        ? " No illustrative CPM is configured."
        : ` Illustrative CPM ${report.illustrativeCpm} (${report.cpmSource}). Not a market rate.`}
    </p>
  );
}

function JokeInvoice({
  report,
  entities,
  reviews,
}: {
  report: CreatorReport;
  entities: CreatorEntity[];
  reviews: Record<string, Review>;
}) {
  return (
    <section className="brand-row">
      <div>
        <h2>Joke invoice</h2>
        <p className="sub">Not a bill and not a debt. Nothing here is owed. Paid evidence is not an amount due.</p>
      </div>
      <ul className="mention-list">
        {entities.map((entity) => {
          const amount = entityAmount(entity, report.illustrativeCpm);
          return (
            <li key={entity.id}>
              <span>{entity.name}</span>
              <span className="sub">
                {reviews[entity.id]?.disclosure ?? entity.disclosure} ·{" "}
                {amount == null ? "no amount, because CPM or views are missing" : money(amount)} · posts counted once
              </span>
            </li>
          );
        })}
      </ul>
      <p className="sub">Line items are not added into unique reach.</p>
    </section>
  );
}

function entityAmount(entity: CreatorEntity, cpm: number | null): number | null {
  if (cpm == null) return null;
  const known = entity.matchingPosts.filter((post) => post.views != null);
  if (known.length === 0) return null;
  return Math.round(known.reduce((sum, post) => sum + ((post.views as number) / 1000) * cpm, 0));
}

function pitch(report: CreatorReport, entity: CreatorEntity, review: Review, cpm: number | null): OutreachDraft {
  const amount = entityAmount(entity, cpm);
  const post = entity.matchingPosts[0];
  return {
    title: `Copy a pitch for ${entity.name}. Nothing is sent.`,
    message: `Hi ${entity.name} team,\n\nI'm @${report.handle}. ${entity.name} appears in ${entity.matchingPostCount} indexed post${entity.matchingPostCount === 1 ? "" : "s"} I reviewed (${review.disclosure}).${post ? ` One post id is ${post.platformId}.` : ""}\n\n${amount == null ? "No illustrative amount is attached." : `An illustrative CPM of ${cpm} puts the non-null views on those posts at about ${money(amount)}. That figure is not a bill and not money owed.`}\n\nI would like to talk about a real arrangement. This message was copied, not sent.`,
  };
}

function labelType(value: CreatorEntity["entityType"]): string {
  if (value === "platform_distribution") return "platform distribution";
  return value;
}
