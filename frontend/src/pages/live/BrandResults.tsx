import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Cards } from "../../components/Cards";
import { Footer } from "../../components/Footer";
import { MoneyHero } from "../../components/MoneyHero";
import { Nav } from "../../components/Nav";
import { OutreachDialog, type OutreachDraft } from "../../components/OutreachDialog";
import { Scan } from "../../components/Scan";
import { useScan } from "../../components/motion";
import { SCAN_STAGES } from "../../content";
import { renderableCreators } from "../../lib/contract";
import { compact } from "../../lib/format";
import { liveCreators, liveItem, liveOutreach, liveViews } from "../../lib/live";
import { HONESTY_NOTE, assessmentCopy, disclosureLabel, holdoutLabel, modelLabel } from "../../lib/present";
import { useBrandSearch } from "../../lib/useBrandSearch";

export function LiveBrandResults() {
  const brand = decodeURIComponent(useParams().brand ?? "");
  const state = useBrandSearch(brand);
  const { scanning, finish } = useScan(`live:brand:${brand}`, false);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const ready = state.status !== "loading";
  const data = state.status === "ready" ? state.data : null;
  const creators = useMemo(() => (data ? liveCreators(data) : []), [data]);
  const items = creators.map((creator) => liveItem(brand, creator));
  const showing = ready && !scanning;
  const copy = data ? assessmentCopy(data.assessmentReason) : null;
  const held = data ? renderableCreators(data.heldOut).creators : [];
  const pending = data ? renderableCreators(data.unassessedCreators).creators : [];
  const views = liveViews(creators);

  return (
    <div className="page">
      {scanning && (
        <Scan
          title={brand}
          stages={SCAN_STAGES.brands}
          items={items.map((item) => ({ text: item.quote, term: brand }))}
          ready={ready}
          onDone={finish}
        />
      )}
      <section className="results">
        <Nav audience="brands" />
        {showing && state.status === "error" && (
          <div className="results-body">
            <h1 className="display live-title">{brand}</h1>
            <div className="result-note" data-testid="search-error" role="alert">
              <p>
                <strong>Search failed</strong>
              </p>
              <p>{state.message}</p>
            </div>
          </div>
        )}
        {showing && data && (
          <>
            {creators.length > 0 ? (
              <MoneyHero
                title={brand}
                active={showing}
                amount={views.total}
                line={(shown) => (views.known ? `${compact(shown)} views to build on.` : "Views unknown so far.")}
                note={
                  views.missing
                    ? "Views on relevant posts in this sample. Some view counts are missing."
                    : "Views on distinct relevant posts in this sample. Views are not unique people."
                }
                stats={[
                  { label: "Ranked creators", value: creators.length },
                  { label: "Relevant posts", value: creators.reduce((sum, creator) => sum + creator.posts, 0) },
                  { label: "Not ranked", value: held.length + pending.length },
                ]}
              />
            ) : (
              <div className="results-body">
                <h1 className="display live-title">{brand}</h1>
              </div>
            )}
            <div className="results-body">
              <details className="search-method" data-testid="search-meta">
                <summary>About these results</summary>
                <p className="live-meta">Instagram, one page of 10 on each channel. {modelLabel(data)} {HONESTY_NOTE}</p>
              </details>
              {copy && (
                <div className="live-note" data-testid="assessment" role="status">
                  <strong>{copy.title}</strong>
                  <p>{copy.text}</p>
                </div>
              )}
              {data.warnings.length > 0 && (
                <ul className="live-list" data-testid="warnings">
                  {data.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              {creators.length > 0 && (
                <section className="live-section">
                  <div className="results-head">
                    <h2>Reach out to these first</h2>
                  </div>
                  <Cards
                    testId="ranked-creators"
                    items={items}
                    action="Reach out"
                    onAction={(id) => {
                      const creator = creators.find((item) => item.key === id);
                      if (creator) setDraft(liveOutreach(brand, creator));
                    }}
                  />
                </section>
              )}
              {creators.length === 0 && !copy && (
                <p className="live-note" role="status">
                  No creator was ranked in this sample.
                </p>
              )}
              {held.length > 0 && (
                <section className="live-section" data-testid="held-out">
                  <h2>Held out</h2>
                  <ul className="live-list">
                    {held.map((creator) => (
                      <li key={creator.creatorKey}>
                        <strong>{creator.handle ? `@${creator.handle}` : creator.creatorKey}</strong>
                        <span>
                          {creator.platform}, {holdoutLabel(creator.holdoutReason)}, {disclosureLabel(creator.disclosure)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {pending.length > 0 && (
                <section className="live-section" data-testid="unassessed">
                  <h2>Unassessed</h2>
                  <p className="live-meta">Not judged. These rows are not a ranking and not a rejection.</p>
                  <ul className="live-list">
                    {pending.map((creator) => (
                      <li key={creator.creatorKey}>
                        <strong>{creator.handle ? `@${creator.handle}` : creator.creatorKey}</strong>
                        <span>
                          {creator.platform}, {creator.judgmentSource || "pending"}, {disclosureLabel(creator.disclosure)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </>
        )}
      </section>
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
      <Footer />
    </div>
  );
}
