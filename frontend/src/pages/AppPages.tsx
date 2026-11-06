import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Cards } from "../components/Cards";
import { BarList } from "../components/Charts";
import { Desk, DeskHead } from "../components/Desk";
import { Highlight } from "../components/Highlight";
import { OutreachDialog } from "../components/OutreachDialog";
import { Pipeline } from "../components/Pipeline";
import { Scan } from "../components/Scan";
import { useScan } from "../components/motion";
import { SCAN_STAGES } from "../content";
import { CreatorReportScreen } from "../creator/CreatorReportScreen";
import { renderableCreators } from "../lib/contract";
import { compact } from "../lib/format";
import { topShare } from "../lib/insights";
import { liveCreators, liveFoundIn, liveItem, liveOutreach, liveViews, type LiveCreator } from "../lib/live";
import { assessmentCopy } from "../lib/present";
import { readSession, useStored, type Session } from "../lib/session";
import { useBrandSearch } from "../lib/useBrandSearch";

const STAGES = ["To contact", "Contacted", "Replied", "Partner"];
const MOVES = ["Mark as sent", "They replied", "Make partner"];

type View = "overview" | "list" | "pipeline";

export function LiveAppPage({ view }: { view: View }) {
  const session = readSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.audience === "creators") {
    return (
      <Desk session={session} listLabel="Brands" pipelineLabel="Pitches">
        <DeskHead title={`@${session.name}`} note="Indexed posts for this handle. Confirm an appearance before anything is valued." />
        <CreatorReportScreen handle={session.name} layout="workspace" />
      </Desk>
    );
  }
  return <BrandWorkspace session={session} view={view} />;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function BrandWorkspace({ session, view }: { session: Session; view: View }) {
  const brand = session.name;
  const state = useBrandSearch(brand);
  const { scanning, finish } = useScan(`live:app:${brand}`, true);
  const [placement, setPlacement] = useStored<Record<string, number>>(`unpaid.pipeline.brands.${brand}`, {});
  const [openId, setOpenId] = useState<string | null>(null);
  const ready = state.status !== "loading";
  const data = state.status === "ready" ? state.data : null;
  const creators = useMemo(() => (data ? liveCreators(data) : []), [data]);
  const showing = ready && !scanning;
  const copy = data ? assessmentCopy(data.assessmentReason) : null;
  const held = data ? renderableCreators(data.heldOut).creators.length + renderableCreators(data.unassessedCreators).creators.length : 0;
  const views = liveViews(creators);
  const stageOf = (id: string) => placement[id] ?? 0;
  const toContact = creators.filter((creator) => stageOf(creator.key) === 0);
  const contacted = creators.length - toContact.length;
  const share = topShare(creators.map((creator) => creator.views ?? 0), 2);
  const open = creators.find((creator) => creator.key === openId) ?? null;

  function move(id: string, stage: number) {
    setPlacement({ ...placement, [id]: stage });
  }

  function idea(creator: LiveCreator) {
    return (
      <article key={creator.key} className="idea">
        <div className="idea-head">
          <div>
            <h3>@{creator.handle}</h3>
            <p>{creator.platform}, {plural(creator.posts, "relevant post")}</p>
          </div>
          <strong>{creator.views === null ? "Views unknown" : `${compact(creator.views)} views`}</strong>
        </div>
        <p className="idea-quote">
          “<Highlight text={creator.excerpt ?? creator.why ?? "No text excerpt was returned."} term={brand} />”
        </p>
        <p className="idea-source">
          {creator.labels.length > 0 ? creator.labels.join(", ") : "No evidence label"}
          {creator.excerpt && creator.why ? `. ${creator.why}` : ""}
        </p>
        <div className="idea-actions">
          <button type="button" className="pill pill-small" onClick={() => setOpenId(creator.key)}>
            Reach out
          </button>
          {creator.postUrl && (
            <a className="pill pill-small pill-soft" href={creator.postUrl} target="_blank" rel="noreferrer">
              See post
            </a>
          )}
        </div>
      </article>
    );
  }

  return (
    <Desk
      session={session}
      listLabel="Creators"
      pipelineLabel="Outreach"
      stat={showing && creators.length > 0 ? { value: `${contacted} of ${creators.length}`, label: "Creators contacted", note: "So far" } : undefined}
    >
      {scanning && (
        <Scan
          title={brand}
          stages={SCAN_STAGES.brands}
          items={creators.map((creator) => ({ text: creator.excerpt ?? creator.why ?? "", term: brand })).filter((item) => item.text)}
          ready={ready}
          onDone={finish}
        />
      )}
      {showing && state.status === "error" && (
        <>
          <DeskHead title="Overview" note="The search did not run" />
          <div className="result-note" data-testid="search-error" role="alert">
            <p>
              <strong>Search failed</strong>
            </p>
            <p>{state.message}</p>
          </div>
        </>
      )}
      {showing && data && view === "overview" && (
        <>
          <DeskHead title="Overview" note="From one page of 10 posts per channel, judged by the model" />
          {copy && (
            <div className="desk-note" data-testid="assessment" role="status">
              <strong>{copy.title}</strong>
              <p>{copy.text}</p>
            </div>
          )}
          {creators.length > 0 && (
            <>
              <section className="lead">
                <h2>
                  {plural(creators.length, "creator")} already got you{" "}
                  <em>{views.known ? `${compact(views.total)} views.` : "views we can't count yet."}</em>
                </h2>
                <p>
                  These creators already show {brand} in their videos, which makes them the easiest partners you will find. Views are
                  post views on the relevant posts, not unique people.
                </p>
              </section>
              <dl className="tiles">
                <div>
                  <dd>{views.known ? `${compact(views.total)}+` : "Unknown"}</dd>
                  <dt>Views</dt>
                </div>
                <div>
                  <dd>{creators.length}</dd>
                  <dt>Creators ranked</dt>
                </div>
                <div>
                  <dd>{creators.reduce((sum, creator) => sum + creator.posts, 0)}</dd>
                  <dt>Relevant posts</dt>
                </div>
                <div>
                  <dd>{held}</dd>
                  <dt>Not ranked</dt>
                </div>
              </dl>
              <div className="desk-split">
                <section className="desk-card">
                  <h3>Where you were found</h3>
                  <BarList rows={liveFoundIn(creators)} />
                </section>
                <section className="desk-card">
                  <h3>Start here</h3>
                  <p className="desk-insight">
                    {views.known
                      ? `Your top 2 creators drive ${share}% of these views. Start with them.`
                      : "View counts are missing, so start with the creators whose posts you recognise."}
                  </p>
                </section>
              </div>
              <section className="desk-section">
                <h3>Partner with these first</h3>
                <div className="desk-panel">
                  {toContact.length > 0 ? (
                    <>
                      <p className="desk-intro">Ranked by views. Each one is already showing {brand}:</p>
                      {toContact.slice(0, 3).map(idea)}
                    </>
                  ) : (
                    <p className="desk-empty">Everyone here has been contacted. Check Outreach for replies.</p>
                  )}
                </div>
                <Link className="desk-more" to="/app/list">
                  See all {plural(creators.length, "creator")}
                </Link>
              </section>
            </>
          )}
        </>
      )}
      {showing && data && view === "list" && (
        <>
          <DeskHead title="Creators" note="Everyone the model ranked" />
          {creators.length > 0 ? (
            <Cards items={creators.map((creator) => liveItem(brand, creator))} action="Reach out" onAction={setOpenId} />
          ) : (
            <p className="desk-empty">No creator was ranked in this sample.</p>
          )}
        </>
      )}
      {showing && data && view === "pipeline" && (
        <>
          <DeskHead title="Outreach" note="Your messages are drafted from each creator's own post. Nothing is sent for you." />
          <Pipeline
            stages={STAGES}
            moves={MOVES}
            placement={placement}
            onMove={move}
            items={creators.map((creator) => ({
              id: creator.key,
              title: `@${creator.handle}`,
              subtitle: `${creator.platform}, ${plural(creator.posts, "relevant post")}`,
              metric: creator.views === null ? "Views unknown" : `${compact(creator.views)} views`,
              message: liveOutreach(brand, creator).message,
              quote: creator.excerpt ?? creator.why ?? "No text excerpt was returned.",
            }))}
          />
        </>
      )}
      <OutreachDialog
        draft={open ? liveOutreach(brand, open) : null}
        onClose={() => setOpenId(null)}
        onSent={open ? () => move(open.key, Math.max(stageOf(open.key), 1)) : undefined}
      />
    </Desk>
  );
}
