import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Desk, DeskHead } from "../components/Desk";
import { OutreachDialog } from "../components/OutreachDialog";
import { Pipeline } from "../components/Pipeline";
import { Loading } from "../components/ResultState";
import { VideoCard } from "../components/VideoCard";
import { renderableCreators, type SearchCreator, type SearchResponse } from "../lib/contract";
import { liveCreators, liveItem } from "../lib/live";
import { assessmentCopy, disclosureLabel, draftNote, holdoutLabel, knownViewTotal } from "../lib/present";
import type { Session } from "../lib/session";
import { useBrandSearch, type BrandSearchState } from "../lib/useBrandSearch";
import { useWorkspace } from "./useWorkspace";
import "./workspace.css";

export type WorkspaceView = "overview" | "list" | "pipeline";
const STAGES = ["To contact", "Contacted", "Replied", "Partner"];
const MOVES = ["Mark as sent", "They replied", "Make partner"];

function SearchRun({ brand, onState }: { brand: string; onState: (state: BrandSearchState) => void }) {
  const state = useBrandSearch(brand);
  useEffect(() => onState(state), [state, onState]);
  return null;
}

function creatorReport(brand: string, creators: SearchCreator[]): SearchResponse {
  return { brand, assessment: "complete", assessmentReason: null, rankedCreators: creators, heldOut: [], unassessedCreators: [], channels: [], warnings: [] };
}

export function BrandWorkspace({ session, view, onBrandChange, sessionWarning }: {
  session: Session;
  view: WorkspaceView;
  onBrandChange: (brand: string) => void;
  sessionWarning: string | null;
}) {
  const brand = session.name;
  const workspace = useWorkspace(brand);
  const data = workspace.result;
  const creators = useMemo(() => data ? liveCreators(data).sort((a, b) => (b.views ?? -1) - (a.views ?? -1)) : [], [data]);
  const savedCreators = useMemo(() => liveCreators(creatorReport(brand, workspace.saved.map(row => row.creator))), [brand, workspace.saved]);
  const [changingBrand, setChangingBrand] = useState(false);
  const [nextBrand, setNextBrand] = useState(brand);
  const [openId, setOpenId] = useState<string | null>(null);
  const savedIds = new Set(workspace.saved.map(row => row.creator.creatorKey));
  const placement = Object.fromEntries(workspace.saved.map(row => [row.creator.creatorKey, row.stage]));
  const contacted = workspace.saved.filter(row => row.stage > 0).length;
  const draft = useMemo(() => {
    const row = workspace.saved.find(item => item.creator.creatorKey === openId);
    if (!row) return null;
    const generated = draftNote(brand, row.creator);
    return { title: `Draft message to @${row.creator.handle || row.creator.creatorKey}`, message: row.draft ?? generated.message };
  }, [brand, openId, workspace.saved]);

  function changeBrand(event: FormEvent) {
    event.preventDefault();
    const clean = nextBrand.trim();
    if (!clean) return;
    setChangingBrand(false);
    onBrandChange(clean);
  }

  const titles = { overview: "Overview", list: "Creators", pipeline: "Outreach" };
  const notes = {
    overview: `Find relevant creators for ${brand}, review their posts, then save the ones to contact.`,
    list: `Your saved creators for ${brand}. Evidence stays available when search results change.`,
    pipeline: "Draft messages and track replies. You send messages yourself; marking a stage only updates this workspace.",
  };

  return (
    <Desk session={session} listLabel="Creators" pipelineLabel="Outreach"
      stat={{ value: `${contacted} of ${workspace.saved.length}`, label: "Saved creators contacted", note: "Stored in this browser" }}>
      {workspace.searching && <SearchRun key={workspace.run} brand={brand} onState={workspace.receiveSearch} />}
      <DeskHead title={titles[view]} note={notes[view]} />
      <div className="workspace-toolbar">
        <span className="workspace-brand">{brand}</span>
        <button type="button" className="pill pill-small" disabled={workspace.searching} onClick={workspace.search}>
          {workspace.searching ? "Searching…" : "Run again"}
        </button>
        <button type="button" className="pill pill-small pill-soft" aria-expanded={changingBrand} onClick={() => setChangingBrand(value => !value)}>Change brand</button>
      </div>
      {changingBrand && (
        <form className="workspace-brand-form" onSubmit={changeBrand}>
          <label htmlFor="workspace-brand">Brand name</label>
          <input id="workspace-brand" value={nextBrand} onChange={event => setNextBrand(event.target.value)} required autoFocus />
          <button type="submit" className="pill pill-small" disabled={!nextBrand.trim()}>Open workspace</button>
        </form>
      )}
      <p className="workspace-local">Saved on this browser only. No account or automatic monitoring.</p>
      {sessionWarning && <p className="workspace-notice" role="alert">{sessionWarning}</p>}
      {workspace.storageWarning && <p className="workspace-notice" role="alert">{workspace.storageWarning}</p>}
      {workspace.searchError && (
        <div className="workspace-notice" role="alert" data-testid="search-error">
          <strong>Search failed</strong><p>{workspace.searchError}</p>
          <p>{data ? "Your previous report and saved creators are still available." : "Try running the search again or change the brand."}</p>
        </div>
      )}
      {workspace.searching && (data ? <p className="workspace-notice" role="status">Updating the search and checking matching posts. Your saved creators remain available.</p>
        : <Loading term={brand} />)}
      {Object.keys(workspace.pendingStages).length > 0 && <p className="workspace-local">Some previous outreach stages belong to creators outside this search. Their stages are kept and will be restored when those creators appear again.</p>}

      {view === "overview" && (
        <>
          <section className="workspace-next" aria-label="Your workspace">
            <Link to="/app/list"><strong>{workspace.saved.length}</strong><span>Saved creators</span></Link>
            <Link to="/app/pipeline"><strong>{workspace.saved.length - contacted}</strong><span>Ready to contact</span></Link>
            <Link to="/app/pipeline"><strong>{contacted}</strong><span>Contacted or further</span></Link>
          </section>
          {data && (
            <>
              <section className="desk-section">
                <h2>Latest search</h2>
                {workspace.searchedAt && <p className="workspace-local">Last updated <time dateTime={workspace.searchedAt}>{new Date(workspace.searchedAt).toLocaleString()}</time></p>}
                <dl className="tiles">
                  <div><dd>{creators.length}</dd><dt>Ranked creators</dt></div>
                  <div><dd>{creators.length ? knownViewTotal(creators.map(row => row.raw)).text : "—"}</dd><dt>Relevant post views</dt></div>
                  <div><dd>{renderableCreators(data.heldOut).creators.length}</dd><dt>Excluded creators</dt></div>
                  <div><dd>{renderableCreators(data.unassessedCreators).creators.length}</dd><dt>Unassessed creators</dt></div>
                </dl>
                <p className="workspace-local">Views on distinct relevant posts in this retrieved sample, not unique people. Disclosure does not establish whether a post was unpaid.</p>
              </section>
              <SearchDetails data={data} />
              {creators.length > 0 && (
                <section className="desk-section">
                  <h2>Review and save creators</h2>
                  <p className="workspace-local">Ranked by relevant post views. Open the matching posts before choosing who to contact.</p>
                  <div className="cards workspace-cards">
                    {creators.map((creator, index) => (
                      <div className="workspace-creator" key={creator.key}>
                        <VideoCard index={index} item={liveItem(brand, creator)} action={savedIds.has(creator.key) ? "Saved creator" : "Save creator"}
                          onAction={() => workspace.save(creator.raw)} />
                        <p className="workspace-local">{disclosureLabel(creator.raw.disclosure)}</p>
                      </div>
                    ))}
                  </div>
                  {workspace.saved.length > 0 && <Link className="desk-more" to="/app/list">Open saved creators</Link>}
                </section>
              )}
            </>
          )}
        </>
      )}

      {view === "list" && (savedCreators.length > 0 ? (
        <div className="cards workspace-cards">
          {savedCreators.map((creator, index) => (
            <div className="workspace-creator" key={creator.key}>
              <VideoCard index={index} item={liveItem(brand, creator)} action="Draft message" onAction={() => setOpenId(creator.key)} />
              <p className="workspace-local">{disclosureLabel(creator.raw.disclosure)} · {STAGES[placement[creator.key]]}</p>
              <p className="workspace-local">Saved evidence from {new Date(workspace.saved[index].savedAt).toLocaleDateString()}. Current results may differ.</p>
              <button className="idea-more" type="button" aria-label={`Remove saved creator: @${creator.handle}`} onClick={() => workspace.remove(creator.key)}>Remove from saved creators</button>
            </div>
          ))}
        </div>
      ) : <EmptySaved />)}

      {view === "pipeline" && (savedCreators.length > 0 ? (
        <>
          <Link className="desk-more" to="/app/list">Edit drafts in saved creators</Link>
          <Pipeline stages={STAGES} moves={MOVES} placement={placement} onMove={(id, stage) => workspace.update(id, { stage })}
            items={savedCreators.map(creator => ({
              id: creator.key, title: `@${creator.handle}`, subtitle: creator.platform,
              metric: knownViewTotal([creator.raw]).text,
              message: workspace.saved.find(row => row.creator.creatorKey === creator.key)?.draft ?? draftNote(brand, creator.raw).message,
              quote: creator.excerpt ?? creator.why ?? "No text excerpt was returned.",
            }))} />
        </>
      ) : <EmptySaved />)}
      <OutreachDialog draft={draft} onClose={() => setOpenId(null)}
        onSaveDraft={openId ? message => { workspace.update(openId, { draft: message }); setOpenId(null); } : undefined}
        onSent={openId ? message => workspace.update(openId, { draft: message, stage: Math.max(placement[openId], 1) }) : undefined} />
    </Desk>
  );
}

function EmptySaved() {
  return <section className="workspace-notice"><h2>No saved creators yet</h2><p>Review the latest search and save creators whose posts fit your brand. They will appear here and in Outreach.</p><Link className="desk-more" to="/app">Review search results</Link></section>;
}

function SearchDetails({ data }: { data: SearchResponse }) {
  const ranked = renderableCreators(data.rankedCreators);
  const held = renderableCreators(data.heldOut);
  const pending = renderableCreators(data.unassessedCreators);
  const copy = assessmentCopy(data.assessmentReason);
  const skipped = ranked.skipped + held.skipped + pending.skipped;
  return <>
    {ranked.creators.length === 0 && <section className="workspace-notice" role="status">
      <h2>No creators ranked in this sample</h2>
      <p>{copy?.text ?? "The retrieved posts did not produce a ranked creator. Review the excluded and unassessed results below, run again, or try another brand."}</p>
      <p>This does not prove that no creators mention your brand.</p>
    </section>}
    {copy && ranked.creators.length > 0 && <p className="workspace-notice" role="status">{copy.title}. {copy.text}</p>}
    {data.warnings.length > 0 && <ul className="workspace-notice" aria-label="Search warnings">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    {skipped > 0 && <p className="workspace-notice">{skipped} result rows could not be displayed.</p>}
    {data.channels.some(channel => channel.status !== "ok") && <details className="workspace-notice"><summary>Search coverage</summary><ul>{data.channels.map((channel, index) => <li key={index}>{channel.channel || "Search channel"}: {channel.status || "Unknown"}{channel.warning ? `. ${channel.warning}` : ""}</li>)}</ul></details>}
    {held.creators.length > 0 && <section className="desk-section"><h2>Excluded from ranking</h2><ul className="workspace-evidence">{held.creators.map(row => <li key={row.creatorKey}><strong>@{row.handle || row.creatorKey}</strong><span>{holdoutLabel(row.holdoutReason)}</span><span>{row.why}</span><small>{disclosureLabel(row.disclosure)}</small></li>)}</ul></section>}
    {pending.creators.length > 0 && <section className="desk-section"><h2>Unassessed</h2><p className="workspace-local">These creators were not judged. They are neither ranked nor rejected.</p><ul className="workspace-evidence">{pending.creators.map(row => <li key={row.creatorKey}><strong>@{row.handle || row.creatorKey}</strong><span>{row.why || "No relevance assessment is available."}</span><small>{disclosureLabel(row.disclosure)}</small></li>)}</ul></section>}
  </>;
}
