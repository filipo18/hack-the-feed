import { useMemo, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { BrandCards, CreatorCards } from "../../components/Cards";
import { BarList, GrowthChart } from "../../components/Charts";
import { Desk, DeskHead } from "../../components/Desk";
import { Highlight } from "../../components/Highlight";
import { OutreachDialog, type OutreachDraft } from "../../components/OutreachDialog";
import { Pipeline } from "../../components/Pipeline";
import { Empty } from "../../components/ResultState";
import { Scan } from "../../components/Scan";
import { useScan } from "../../components/motion";
import { useResult } from "../../components/useResult";
import { SCAN_STAGES } from "../../content";
import { searchBrand, searchCreator } from "../../lib/api";
import { CHANNEL_LABEL, compact, money } from "../../lib/format";
import { cumulativeViews, foundIn, topShare } from "../../lib/insights";
import { brandOutreach, creatorPitch } from "../../lib/messages";
import { rankBrands, rankCreators, type RankedBrand, type RankedCreator } from "../../lib/rank";
import { readSession, useStored, type Session } from "../../lib/session";
import type { Mention } from "../../lib/types";

type View = "overview" | "list" | "pipeline";

interface DeskItem {
  id: string;
  title: string;
  subtitle: string;
  metric: string;
  top: Mention;
  videos: number;
  draft: OutreachDraft;
}

interface Setup {
  listLabel: string;
  pipelineLabel: string;
  pipelineNote: string;
  stages: string[];
  moves: string[];
  lead: ReactNode;
  leadNote: string;
  insight: string;
  tiles: { label: string; value: string }[];
  chartTitle: string;
  chartUnit: string;
  panelTitle: string;
  panelIntro: string;
  action: string;
  allDone: string;
  seeAll: string;
  sideLabel: string;
}

export function AppPage({ view }: { view: View }) {
  const session = readSession();
  if (!session) return <Navigate to="/login" replace />;
  return session.audience === "brands" ? (
    <BrandWorkspace session={session} view={view} />
  ) : (
    <CreatorWorkspace session={session} view={view} />
  );
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function BrandWorkspace({ session, view }: { session: Session; view: View }) {
  const loaded = useResult(() => searchBrand(session.name), session.name);
  const creators = useMemo(() => (loaded ? rankCreators(loaded.data) : []), [loaded]);
  const [market, setMarket] = useState("All");
  const mentions = creators.flatMap((creator) => creator.mentions);
  const views = creators.reduce((sum, creator) => sum + creator.views, 0);
  const share = topShare(creators.map((creator) => creator.views), 2);
  const markets = ["All", ...new Set(creators.map((creator) => creator.market))];

  const setup: Setup = {
    listLabel: "Creators",
    pipelineLabel: "Outreach",
    pipelineNote: "Your messages are drafted from each creator's own video. Nothing is sent for you.",
    stages: ["To contact", "Contacted", "Replied", "Partner"],
    moves: ["Mark as sent", "They replied", "Make partner"],
    lead: (
      <>
        {plural(creators.length, "creator")} already got you <em>{compact(views)} impressions.</em>
      </>
    ),
    leadNote: "None of these posts has an ad marker, so you may not know they exist. These creators already show your brand, which makes them the easiest partners you will find.",
    insight: `Your top 2 creators drive ${share}% of these impressions. Start with them.`,
    tiles: [
      { label: "Impressions", value: `${compact(views)}+` },
      { label: "Creators", value: `${creators.length}+` },
      { label: "Videos", value: `${mentions.length}+` },
      { label: "Ad posts removed", value: String(loaded?.data.paidPostsRemoved ?? 0) },
    ],
    chartTitle: "Impressions so far",
    chartUnit: "impressions",
    panelTitle: "Partner with these first",
    panelIntro: "Ranked by impressions. Each one is already showing your brand:",
    action: "Reach out",
    allDone: "Everyone here has been contacted. Check Outreach for replies.",
    seeAll: `See all ${plural(creators.length, "creator")}`,
    sideLabel: "Creators contacted",
  };

  const items: DeskItem[] = creators.map((creator) => ({
    id: creator.handle,
    title: `@${creator.handle}`,
    subtitle: `${compact(creator.followers)} followers, ${creator.market}`,
    metric: `${compact(creator.views)} impressions`,
    top: creator.top,
    videos: creator.mentions.length,
    draft: brandOutreach(session.name, creator),
  }));

  const shown = creators.filter((creator) => market === "All" || creator.market === market);

  return (
    <Workspace
      session={session}
      view={view}
      ready={Boolean(loaded)}
      sample={loaded?.sample}
      setup={setup}
      items={items}
      mentions={mentions}
      title={session.name}
      scanItems={creators.map((creator) => ({ text: creator.top.snippet, term: creator.top.brand }))}
      list={(open) => (
        <>
          <div className="filter" role="group" aria-label="Filter by market">
            {markets.map((item) => (
              <button key={item} type="button" className={item === market ? "active" : undefined} onClick={() => setMarket(item)}>
                {item}
              </button>
            ))}
          </div>
          <CreatorCards creators={shown} onContact={(creator: RankedCreator) => open(creator.handle)} />
        </>
      )}
    />
  );
}

function CreatorWorkspace({ session, view }: { session: Session; view: View }) {
  const loaded = useResult(() => searchCreator(session.name), session.name);
  const brands = useMemo(() => (loaded ? rankBrands(loaded.data) : []), [loaded]);
  const mentions = brands.flatMap((entry) => entry.mentions);
  const views = brands.reduce((sum, entry) => sum + entry.views, 0);
  const value = brands.reduce((sum, entry) => sum + entry.value, 0);
  const share = topShare(brands.map((entry) => entry.value), 2);

  const setup: Setup = {
    listLabel: "Brands",
    pipelineLabel: "Pitches",
    pipelineNote: "Your pitches are drafted from your own videos and numbers. Nothing is sent for you.",
    stages: ["To pitch", "Pitched", "Replied", "Deal"],
    moves: ["Mark as sent", "They replied", "Mark as deal"],
    lead: (
      <>
        {plural(brands.length, "brand")} in your videos, worth <em>{money(value)}.</em>
      </>
    ),
    leadNote: "That is what the same reach would cost these brands to buy. It is an estimate, not money owed, and it is your best opening for a deal.",
    insight: `Your top 2 brands make up ${share}% of that value. Pitch them first.`,
    tiles: [
      { label: "Worth to brands", value: money(value) },
      { label: "Brands", value: `${brands.length}+` },
      { label: "Views", value: `${compact(views)}+` },
      { label: "Ad posts removed", value: String(loaded?.data.paidPostsRemoved ?? 0) },
    ],
    chartTitle: "Views on brands so far",
    chartUnit: "views",
    panelTitle: "Pitch these first",
    panelIntro: "Ranked by value. Each one is already in your videos:",
    action: "Pitch",
    allDone: "Every brand here has been pitched. Check Pitches for replies.",
    seeAll: `See all ${plural(brands.length, "brand")}`,
    sideLabel: "Brands pitched",
  };

  const items: DeskItem[] = brands.map((entry) => ({
    id: entry.brand,
    title: entry.brand,
    subtitle: `${compact(entry.views)} views, ${plural(entry.mentions.length, "video")}`,
    metric: money(entry.value),
    top: entry.top,
    videos: entry.mentions.length,
    draft: creatorPitch(session.name, entry),
  }));

  return (
    <Workspace
      session={session}
      view={view}
      ready={Boolean(loaded)}
      sample={loaded?.sample}
      setup={setup}
      items={items}
      mentions={mentions}
      title={`@${session.name}`}
      scanItems={brands.map((entry) => ({ text: entry.top.snippet, term: entry.top.brand }))}
      list={(open) => <BrandCards brands={brands} onPitch={(entry: RankedBrand) => open(entry.brand)} />}
    />
  );
}

function Workspace({
  session,
  view,
  ready,
  sample,
  setup,
  items,
  mentions,
  title,
  scanItems,
  list,
}: {
  session: Session;
  view: View;
  ready: boolean;
  sample?: boolean;
  setup: Setup;
  items: DeskItem[];
  mentions: Mention[];
  title: string;
  scanItems: { text: string; term: string }[];
  list: (open: (id: string) => void) => ReactNode;
}) {
  const { scanning, finish } = useScan(`app:${session.audience}:${session.name}`, true);
  const [placement, setPlacement] = useStored<Record<string, number>>(`unpaid.pipeline.${session.audience}.${session.name}`, {});
  const [openId, setOpenId] = useState<string | null>(null);
  const showing = ready && !scanning;
  const stageOf = (id: string) => placement[id] ?? 0;
  const toContact = items.filter((item) => stageOf(item.id) === 0);
  const contacted = items.length - toContact.length;
  const openItem = items.find((item) => item.id === openId) ?? null;

  function move(id: string, stage: number) {
    setPlacement({ ...placement, [id]: stage });
  }

  return (
    <Desk
      session={session}
      listLabel={setup.listLabel}
      pipelineLabel={setup.pipelineLabel}
      stat={showing && items.length > 0 ? { value: `${contacted} of ${items.length}`, label: setup.sideLabel, note: "So far" } : undefined}
    >
      {scanning && <Scan title={title} stages={SCAN_STAGES[session.audience]} items={scanItems} ready={ready} onDone={finish} />}
      {showing && items.length === 0 && <Empty term={title} back="/login" />}
      {showing && items.length > 0 && view === "overview" && (
        <>
          <DeskHead title="Overview" note="From the videos we can read so far" sample={sample} />
          <section className="lead">
            <h2>{setup.lead}</h2>
            <p>{setup.leadNote}</p>
          </section>
          <dl className="tiles">
            {setup.tiles.map((tile) => (
              <div key={tile.label}>
                <dd>{tile.value}</dd>
                <dt>{tile.label}</dt>
              </div>
            ))}
          </dl>
          <div className="desk-split">
            <section className="desk-card">
              <h3>{setup.chartTitle}</h3>
              <GrowthChart points={cumulativeViews(mentions)} unit={setup.chartUnit} />
            </section>
            <section className="desk-card">
              <h3>Where you were found</h3>
              <BarList rows={foundIn(mentions)} />
              <p className="desk-insight">{setup.insight}</p>
            </section>
          </div>
          <section className="desk-section">
            <h3>{setup.panelTitle}</h3>
            <div className="desk-panel">
              {toContact.length > 0 ? (
                <>
                  <p className="desk-intro">{setup.panelIntro}</p>
                  {toContact.slice(0, 3).map((item) => (
                    <article key={item.id} className="idea">
                      <div className="idea-head">
                        <div>
                          <h3>{item.title}</h3>
                          <p>{item.subtitle}</p>
                        </div>
                        <strong>{item.metric}</strong>
                      </div>
                      <p className="idea-quote">
                        “<Highlight text={item.top.snippet} term={item.top.brand} />”
                      </p>
                      <p className="idea-source">
                        {item.top.channels.map((channel) => CHANNEL_LABEL[channel]).join(", ")}
                        {item.top.timestamp && ` at ${item.top.timestamp}`}, {plural(item.videos, "video")}
                      </p>
                      <div className="idea-actions">
                        <button type="button" className="pill pill-small" onClick={() => setOpenId(item.id)}>
                          {setup.action}
                        </button>
                        <a className="pill pill-small pill-soft" href={item.top.postUrl} target="_blank" rel="noreferrer">
                          See video
                        </a>
                      </div>
                    </article>
                  ))}
                </>
              ) : (
                <p className="desk-empty">{setup.allDone}</p>
              )}
            </div>
            <Link className="desk-more" to="/app/list">
              {setup.seeAll}
            </Link>
          </section>
        </>
      )}
      {showing && items.length > 0 && view === "list" && (
        <>
          <DeskHead title={setup.listLabel} note="Everyone we found, ranked" sample={sample} />
          {list(setOpenId)}
        </>
      )}
      {showing && items.length > 0 && view === "pipeline" && (
        <>
          <DeskHead title={setup.pipelineLabel} note={setup.pipelineNote} sample={sample} />
          <Pipeline
            stages={setup.stages}
            moves={setup.moves}
            placement={placement}
            onMove={move}
            items={items.map((item) => ({
              id: item.id,
              title: item.title,
              subtitle: item.subtitle,
              metric: item.metric,
              message: item.draft.message,
              quote: item.top.snippet,
            }))}
          />
        </>
      )}
      <OutreachDialog
        draft={openItem?.draft ?? null}
        onClose={() => setOpenId(null)}
        onSent={openItem ? () => move(openItem.id, Math.max(stageOf(openItem.id), 1)) : undefined}
      />
    </Desk>
  );
}
