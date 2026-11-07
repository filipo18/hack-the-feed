import { useState } from "react";
import { OutreachDialog, type OutreachDraft } from "./OutreachDialog";
import { postViews } from "../lib/creatorReport";
import { compact, money } from "../lib/format";
import type { CreatorEntity, CreatorReport, ReviewDisclosure } from "../lib/types";

const BILLABLE = new Set<CreatorEntity["entityType"]>(["brand", "product"]);

type Review = { confirmed: boolean; disclosure: ReviewDisclosure };

export function CreatorReportView({
  report,
  sample,
  showPipeline,
}: {
  report: CreatorReport;
  sample: boolean;
  showPipeline?: boolean;
}) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const reviewOf = (entity: CreatorEntity): Review =>
    reviews[entity.id] ?? { confirmed: false, disclosure: entity.disclosure };

  const confirmed = report.entities.filter((entity) => reviewOf(entity).confirmed && BILLABLE.has(entity.entityType));
  const cpm = report.illustrativeCpm;
  const brands = report.entities.filter((entity) => BILLABLE.has(entity.entityType));
  const otherMentions = report.entities.filter((entity) => !BILLABLE.has(entity.entityType));

  return (
    <div className="creator-report" data-testid="creator-report">
      <div className="creator-summary">
        <p><strong>{report.retrieval.returnedCount} Instagram {report.retrieval.returnedCount === 1 ? "post" : "posts"}</strong> in this sample</p>
        {sample && <span className="sample-tag">Sample data</span>}
        <details className="creator-coverage">
          <summary>Sample coverage</summary>
          <p className="sub">
            Indexed {report.retrieval.indexedTotalCount ?? "unknown"} · returned {report.retrieval.returnedCount} of cap {report.retrieval.cap}.
            {report.retrieval.earliestPublishedAt && ` ${report.retrieval.earliestPublishedAt.slice(0, 10)} to ${report.retrieval.latestPublishedAt?.slice(0, 10)}.`}
            {report.retrieval.paginationComplete == null
              ? " Index coverage is unknown."
              : report.retrieval.paginationComplete
                ? " All currently indexed posts returned."
                : " More indexed posts may be available."}
            {" This is not a complete account history. Views are not unique reach."}
          </p>
        </details>
      </div>
      <Assessment report={report} />
      {report.retrieval.message === "no indexed content found" && (
        <p className="result-note">No Instagram posts were found in the index for this handle. Try another handle. The index does not cover every account or post.</p>
      )}
      {!showPipeline && report.posts.length > 0 && (
        <section aria-label="Brands and products">
          <div className="creator-section-head"><h2>Brands and products</h2><span className="sub">{brands.length} to review</span></div>
          <p className="sub">Names found in these posts. Review the evidence before confirming an appearance.</p>
          {brands.length === 0 && report.posts.length > 0 && <p className="result-note">No brand or product names are ready to review.</p>}
          <div className="brand-list">
          {brands.map((entity) => {
            const review = reviewOf(entity);
            const amount = review.confirmed ? entityAmount(entity, cpm) : null;
            const views = postViews(entity.matchingPosts);
            return (
              <article key={entity.id} className="brand-row">
                <div className="brand-main">
                  <h2>{entity.name}</h2>
                  <p className={views.total == null ? "creator-views-unknown" : "brand-value"}>{views.total == null ? "Views unknown" : compact(views.total)}</p>
                  <p className="sub">Post views{views.incomplete && views.total != null ? " · partial count" : ""}</p>
                  {amount != null && <p className="creator-estimate">{money(amount)} illustrative value at {cpm} CPM</p>}
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
                        {item.field.replaceAll("_", " ")}
                        {item.timestampSeconds != null && ` at ${item.timestampSeconds}s`} · {item.platformId} ·{" "}
                        {item.views == null ? "views unknown" : `${compact(item.views)} views`} · {review.confirmed ? "appearance confirmed" : "needs review"}
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
                    Disclosure
                    <select
                      aria-label={`Disclosure for ${entity.name}`}
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
                    </select>
                  </label>
                </div>
              </article>
            );
          })}
          </div>
        </section>
      )}
      {!showPipeline && otherMentions.length > 0 && (
        <details className="creator-other" data-testid="other-mentions">
          <summary>Other mentions ({otherMentions.length})</summary>
          <p className="sub">People, teams, and publishing platforms are shown as context.</p>
          <ul>
            {otherMentions.map((entity) => (
              <li key={entity.id}>
                <h3>{entity.name}</h3>
                <p className="sub">{labelType(entity.entityType)} · {entity.matchingPostCount} {entity.matchingPostCount === 1 ? "post" : "posts"}</p>
                {entity.evidence.map((item, index) => <p className="sub" key={index}>{item.snippet ?? "Frame evidence"} · {item.field.replaceAll("_", " ")} · {item.platformId}</p>)}
              </li>
            ))}
          </ul>
        </details>
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
      {confirmed.length > 0 && cpm != null && <JokeInvoice report={report} entities={confirmed} reviews={reviews} />}
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function Assessment({ report }: { report: CreatorReport }) {
  if (report.retrieval.status === "not_configured") {
    return <p className="result-note" data-testid="creator-assessment">Instagram search is unavailable. Oriane is not configured.</p>;
  }
  if (report.retrieval.status === "failed") {
    return <p className="result-note" data-testid="creator-assessment">{report.retrieval.message ?? "Instagram posts could not be loaded. Please try again."}</p>;
  }
  if (report.posts.length === 0) return null;
  const reason = report.assessment.visionReason ?? report.assessment.reason;
  const vision = report.assessment.vision === "complete"
    ? `Visual analysis checked ${report.visionFramesSent} frame${report.visionFramesSent === 1 ? "" : "s"}. Appearances still need review.`
    : report.assessment.vision === "failed"
      ? "Visual analysis failed. These results may miss appearances visible only in video."
      : reason === "no_frames" || report.posts.every((post) => post.frameCount === 0)
        ? "No video frames were available for visual analysis."
        : reason === "gmi_not_configured"
          ? "Analysis is unavailable. The model is not configured."
          : reason === "model_vision_not_confirmed"
            ? "Visual analysis is not enabled. These results use captions, mentions, transcripts, and on-screen text."
            : "Visual analysis was not run. These results use the available text evidence.";
  return (
    <div className="creator-assessment" data-testid="creator-assessment">
      {report.assessment.text === "failed" && <p>Text analysis failed. Some mentions may be missing.</p>}
      {report.assessment.text === "unassessed" && <p>Text analysis has not run.</p>}
      <p>{vision}</p>
      {report.textWindowTruncated && <p>Some post text was shortened for analysis.</p>}
      {report.illustrativeCpm != null && <p>Illustrative CPM: {report.illustrativeCpm}. Estimates appear after confirmation and are not a market rate or money owed.</p>}
    </div>
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
  const { total } = postViews(entity.matchingPosts);
  return total == null ? null : Math.round((total / 1000) * cpm);
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
