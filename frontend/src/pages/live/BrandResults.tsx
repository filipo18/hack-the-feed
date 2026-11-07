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
import { assessmentCopy, disclosureLabel, holdoutLabel } from "../../lib/present";
import { useBrandSearch } from "../../lib/useBrandSearch";
import { bestFitCreators } from "../../lib/brandDepth";

export function LiveBrandResults() {
  const brand = decodeURIComponent(useParams().brand ?? "");
  const state = useBrandSearch(brand);
  const { scanning, finish } = useScan(`live:brand:${brand}`, false);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [sort, setSort] = useState<"fit" | "views">("fit");
  const [tagFilter, setTagFilter] = useState({ brand, tag: "" });
  const tag = tagFilter.brand === brand ? tagFilter.tag : "";
  const ready = state.status !== "loading";
  const data = state.status === "ready" ? state.data : null;
  const creators = useMemo(() => {
    if (!data) return [];
    const valid = renderableCreators(data.rankedCreators).creators;
    const rows = sort === "fit" ? bestFitCreators(valid) : valid.sort((a, b) => (b.sumViews ?? -1) - (a.sumViews ?? -1) || a.creatorKey.localeCompare(b.creatorKey));
    return liveCreators({ ...data, rankedCreators: rows });
  }, [data, sort]);
  const items = creators.map((creator) => liveItem(brand, creator));
  const tags = [...new Set(items.flatMap(item => item.signals ?? []))].sort();
  const filteredItems = tag ? items.filter(item => item.signals?.includes(tag)) : items;
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
                    <h2>Your creator shortlist</h2>
                    <div className="match-controls">
                      <label className="match-sort">Filter by tag
                        <select value={tag} onChange={event => setTagFilter({ brand, tag: event.target.value })}>
                          <option value="">All tags</option>
                          {tag && !tags.includes(tag) && <option value={tag}>{tag}</option>}
                          {tags.map(label => <option key={label} value={label}>{label}</option>)}
                        </select>
                      </label>
                      <label className="match-sort">Sort by
                        <select value={sort} onChange={event => setSort(event.target.value as "fit" | "views")}>
                          <option value="fit">Best fit</option>
                          <option value="views">Most relevant views</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  {state.status === "ready" && state.deeper.total > 0 && (
                    <p className="depth-progress" role="status" aria-live="polite">
                      {state.deeper.finished < state.deeper.total
                        ? `Checking more brand mentions · ${state.deeper.finished} of ${state.deeper.total} creators checked. Results update as evidence arrives.`
                        : `Deeper search finished for ${state.deeper.total} creators.`}
                      {state.deeper.failed > 0 && ` ${state.deeper.failed} checks were incomplete or unavailable; earlier verified matches are retained.`}
                    </p>
                  )}
                  {tag && <p className="match-filter-count" role="status">Showing {filteredItems.length} of {items.length} creators · {tag}</p>}
                  {filteredItems.length === 0 && <p className="live-note">No creators match this tag. Choose All tags to see every creator.</p>}
                  <Cards
                    testId="ranked-creators"
                    items={filteredItems}
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
