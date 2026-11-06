import { useMemo, useState } from "react";
import { caveatSentence, factualPitch, fictionalInvoice, formatUsdFromCents, formatViews, reasonSentence } from "./domain/copy";
import { runPilot } from "./domain/pipeline";
import type { Appearance, CreatorMark } from "./domain/types";
import { DEMO_CONTENTS, DEMO_VISUAL_HITS, INITIAL_MARKS, SAMPLE_HANDLE, SYNTHETIC_LABEL } from "./demo/fixtures";

export function App() {
  const [marks, setMarks] = useState<Record<string, CreatorMark>>(INITIAL_MARKS);
  const result = useMemo(
    () =>
      runPilot({
        contents: DEMO_CONTENTS,
        visualHits: DEMO_VISUAL_HITS,
        marks,
        orianeAggregationTotalViews: 9_999_999,
      }),
    [marks],
  );
  const invoice = fictionalInvoice(result.valuation);
  const pitch = factualPitch(result.valuation, `@${SAMPLE_HANDLE}`);
  const collapsed = result.dedupe.filter((note) => note.copies > 1);

  function setMark(id: string, mark: CreatorMark) {
    setMarks((current) => ({ ...current, [id]: mark }));
  }

  return (
    <main>
      <header>
        <p className="kicker">Local pilot · synthetic data · no request sent</p>
        <h1>Who owes you</h1>
        <p className="lede">
          The name is a joke. This page reviews brand appearances in one creator&apos;s videos and
          illustrates a media range under a CPM assumption you can see. It does not calculate a debt,
          and it does not claim the views were ads.
        </p>
      </header>

      <section className="sheet" aria-labelledby="source-title">
        <h2 id="source-title">What Oriane does not return</h2>
        <p>
          A creator-filtered content search can return the handle, caption, hashtags, views, thumbnail,
          transcript, and frames. The public schema has no brand list, no paid-partnership flag, and no
          canonical post URL. Brand names and sponsorship status on this page come from our rules plus
          the creator&apos;s marks.
        </p>
        <dl className="facts">
          <div>
            <dt>Handle</dt>
            <dd>@{SAMPLE_HANDLE}</dd>
          </div>
          <div>
            <dt>Rows</dt>
            <dd>{SYNTHETIC_LABEL}</dd>
          </div>
          <div>
            <dt>Post link</dt>
            <dd>Not in the schema. Platform id is shown instead.</dd>
          </div>
          <div>
            <dt>Audience country</dt>
            <dd>Unknown. A tagged location would not be the audience.</dd>
          </div>
        </dl>
      </section>

      {collapsed.length > 0 && (
        <div className="note">
          <p>Duplicate videos collapsed on platform + platform id.</p>
          <ul>
            {collapsed.map((note) => (
              <li key={note.key}>
                {note.key}: {note.copies} rows{note.viewsConflict ? ", view counts disagree" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="queue-title">
        <h2 id="queue-title">Review</h2>
        <p className="section-lead">
          Explicit disclosure stays held. No disclosure stays in review. Organic is available only after
          a mark, and a homonym is not assigned to the brand.
        </p>
        <div className="queue">
          {result.appearances.map((appearance) => (
            <article key={appearance.id} className="item" data-testid={`row-${appearance.platformId}`}>
              <div className="item-main">
                <p className="item-kicker">
                  {appearance.platform} · {appearance.platformId}
                  {appearance.syntheticLabel ? " · synthetic" : ""}
                </p>
                <h3>
                  {appearance.brandName}
                  <span className="status"> {statusLabel(appearance)}</span>
                </h3>
                <p>{evidenceSentence(appearance)}</p>
                <ul className="reasons">
                  {appearance.disclosureReasons
                    .filter((code) => code !== "platform_paid_field_absent")
                    .map((code) => (
                      <li key={code}>{reasonSentence(code)}</li>
                    ))}
                  {appearance.brandNotes.map((code) => (
                    <li key={code}>{reasonSentence(code)}</li>
                  ))}
                </ul>
                <p className="meta">
                  Views {appearance.viewsCount === null ? "unknown" : formatViews(appearance.viewsCount)}
                  {appearance.viewsConflict ? " · duplicate rows disagreed" : ""}
                  {" · "}
                  {appearance.exclusion ? "Not in the illustration" : "In the illustration"}
                </p>
              </div>
              <div className="actions" role="group" aria-label={`Mark ${appearance.brandName}`}>
                <button type="button" aria-pressed={appearance.creatorMark === "organic"} onClick={() => setMark(appearance.id, "organic")}>
                  Organic
                </button>
                <button type="button" aria-pressed={appearance.creatorMark === "paid_deal"} onClick={() => setMark(appearance.id, "paid_deal")}>
                  Paid deal
                </button>
                <button
                  type="button"
                  aria-pressed={appearance.creatorMark === "false_positive"}
                  onClick={() => setMark(appearance.id, "false_positive")}
                >
                  Not this brand
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="held-title">
        <h2 id="held-title">Held out as homonyms</h2>
        <p className="section-lead">These name matches were rejected before review. They are not appearances.</p>
        <ul className="held">
          {result.heldOut.map((hit) => (
            <li key={hit.id}>
              <strong>{hit.brandName}</strong> on {hit.platformId}. {hit.captionExcerpt}{" "}
              {hit.textEvidence[0] ? `Matched “${hit.textEvidence[0].excerpt}”.` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="numbers" aria-labelledby="numbers-title">
        <h2 id="numbers-title">Illustrated range</h2>
        <p>
          CPM assumptions, owned by the pricing pass and easy to replace:{" "}
          {result.valuation.cpmScenarios.map((scenario) => `$${scenario.cpmUsd} ${scenario.label.toLowerCase()}`).join(", ")}
          . Formula: allocated views ÷ 1,000 × CPM. Oriane&apos;s aggregate view total is ignored
          {result.ignoredAggregationTotalViews !== null ? ` (a planted ${formatViews(result.ignoredAggregationTotalViews)} is not used)` : ""}.
        </p>
        {result.valuation.lines.length === 0 ? (
          <p>No creator-confirmed organic rows.</p>
        ) : (
          <ul className="lines">
            {result.valuation.lines.map((line) => (
              <li key={line.appearanceId}>
                <strong>{line.brandName}</strong>
                {". "}
                {line.allocatedViews === null
                  ? "No view count on this line."
                  : `${formatViews(line.allocatedViews)} allocated views.`}
                {" "}
                {line.scenarios.map((scenario) => (
                  <span key={scenario.id}>
                    {scenario.label}{" "}
                    {scenario.illustrativeCents === null ? "—" : formatUsdFromCents(scenario.illustrativeCents)}
                    .{" "}
                  </span>
                ))}
                <span className="caveat">{line.caveats.map(caveatSentence).join(" ")}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="meta">
          {result.valuation.sumComplete
            ? `Known video views behind included lines, counted once: ${formatViews(result.valuation.grossKnownVideoViews)}. Allocated views in the sum: ${formatViews(result.valuation.allocatedViewsInSum)}.`
            : "The sum is incomplete while any included line is missing views."}{" "}
          Geography: unknown.
        </p>
      </section>

      <div className="split">
        <section aria-labelledby="invoice-title">
          <h2 id="invoice-title">Joke invoice</h2>
          <p className="banner">{invoice.banner}</p>
          {invoice.empty ? <p>{invoice.empty}</p> : null}
          <ul>
            {invoice.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="footer">{invoice.footer}</p>
        </section>
        <section aria-labelledby="pitch-title">
          <h2 id="pitch-title">Sponsorship pitch</h2>
          <p>{pitch}</p>
        </section>
      </div>
    </main>
  );
}

function statusLabel(appearance: Appearance): string {
  if (appearance.disclosure === "disclosed") return "Disclosed";
  if (appearance.disclosure === "creator_confirmed_organic") return "Creator-confirmed organic";
  if (appearance.resolution === "ambiguous_homonym") return "Name needs a decision";
  return "Review";
}

function evidenceSentence(appearance: Appearance): string {
  if (appearance.resolution === "visual_only") {
    const hit = appearance.visualEvidence[0];
    return hit
      ? `Visual similarity ${hit.score.toFixed(2)} at ${hit.timestampSeconds}s on asset ${hit.assetId}. No brand name came back with the frame.`
      : "Visual similarity only.";
  }
  if (appearance.resolution === "ambiguous_homonym") {
    const excerpt = appearance.textEvidence[0]?.excerpt;
    return excerpt
      ? `Unresolved name in the text: “${excerpt}”.`
      : "Unresolved name. Not assigned to the brand.";
  }
  const excerpt = appearance.textEvidence[0]?.excerpt;
  const channel = appearance.textEvidence[0]?.channel.replaceAll("_", " ");
  if (excerpt && channel) return `Text in the ${channel}: “${excerpt}”.`;
  return "Text mention.";
}
