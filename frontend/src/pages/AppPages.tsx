import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BrandCards, CreatorCards } from "../components/Cards";
import { MoneyHero } from "../components/MoneyHero";
import { OutreachDialog, type OutreachDraft } from "../components/OutreachDialog";
import { Pipeline } from "../components/Pipeline";
import { Empty } from "../components/ResultState";
import { Scan } from "../components/Scan";
import { useScan } from "../components/motion";
import { useResult } from "../components/useResult";
import { SCAN_STAGES } from "../content";
import { searchBrand, searchCreator } from "../lib/api";
import { compact, money } from "../lib/format";
import { brandOutreach, creatorPitch } from "../lib/messages";
import { rankBrands, rankCreators, type RankedBrand, type RankedCreator } from "../lib/rank";
import { useStored, type Session } from "../lib/session";

const BRAND_STAGES = ["To contact", "Contacted", "Replied", "Partner"];
const CREATOR_STAGES = ["To pitch", "Pitched", "Replied", "Deal"];

type View = "overview" | "list" | "pipeline";

export function AppPage({ view }: { view: View }) {
  return (
    <AppShell>
      {(session) =>
        session.audience === "brands" ? (
          <BrandWorkspace session={session} view={view} />
        ) : (
          <CreatorWorkspace session={session} view={view} />
        )
      }
    </AppShell>
  );
}

function usePlacement(session: Session) {
  return useStored<Record<string, number>>(`unpaid.pipeline.${session.audience}.${session.name}`, {});
}

function SectionHead({ title, sample }: { title: string; sample?: boolean }) {
  return (
    <div className="results-head">
      <h2>{title}</h2>
      {sample && <span className="sample-tag">Sample data</span>}
    </div>
  );
}

function PageTitle({ title, sample }: { title: string; sample?: boolean }) {
  return (
    <div className="page-title">
      <h1 className="display">{title}</h1>
      {sample && <span className="sample-tag">Sample data</span>}
    </div>
  );
}

function BrandWorkspace({ session, view }: { session: Session; view: View }) {
  const loaded = useResult(() => searchBrand(session.name), session.name);
  const { scanning, finish } = useScan(`app:brand:${session.name}`, true);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [placement, setPlacement] = usePlacement(session);
  const [market, setMarket] = useState("All");
  const data = loaded?.data;
  const creators = useMemo(() => (data ? rankCreators(data) : []), [data]);
  const showing = Boolean(data) && !scanning;

  const stageOf = (creator: RankedCreator) => placement[creator.handle] ?? 0;
  const open = creators.filter((creator) => stageOf(creator) === 0);
  const markets = ["All", ...new Set(creators.map((creator) => creator.market))];
  const shown = creators.filter((creator) => market === "All" || creator.market === market);

  function contact(creator: RankedCreator) {
    setDraft(brandOutreach(session.name, creator));
    setPlacement({ ...placement, [creator.handle]: Math.max(stageOf(creator), 1) });
  }

  return (
    <>
      {scanning && (
        <Scan
          title={session.name}
          stages={SCAN_STAGES.brands}
          items={creators.map((creator) => ({ text: creator.top.snippet, term: creator.top.brand }))}
          ready={Boolean(data)}
          onDone={finish}
        />
      )}
      {showing && creators.length === 0 && <Empty term={session.name} back="/login" />}
      {showing && creators.length > 0 && view === "overview" && (
        <>
          <MoneyHero
            title={session.name}
            active={showing}
            amount={creators.reduce((sum, creator) => sum + creator.cost, 0)}
            stats={[
              { label: "Creators to contact", value: open.length, prefix: "At least " },
              { label: "Views on your brand", value: creators.reduce((sum, creator) => sum + creator.views, 0), prefix: "At least " },
              { label: "Ad posts removed", value: data?.paidPostsRemoved ?? 0 },
            ]}
          />
          <div className="results-body">
            <SectionHead title="Contact these first" sample={loaded?.sample} />
            {open.length > 0 ? (
              <CreatorCards creators={open.slice(0, 4)} onContact={contact} />
            ) : (
              <p className="result-note">Everyone here has been contacted. Check Outreach for replies.</p>
            )}
            <Link className="app-more" to="/app/list">
              See all {creators.length} creators
            </Link>
          </div>
        </>
      )}
      {showing && creators.length > 0 && view === "list" && (
        <div className="results-body">
          <PageTitle title="Creators" sample={loaded?.sample} />
          <div className="filter" role="group" aria-label="Filter by market">
            {markets.map((item) => (
              <button key={item} type="button" className={item === market ? "active" : undefined} onClick={() => setMarket(item)}>
                {item}
              </button>
            ))}
          </div>
          <CreatorCards creators={shown} onContact={contact} />
        </div>
      )}
      {showing && creators.length > 0 && view === "pipeline" && (
        <div className="results-body">
          <PageTitle title="Outreach" sample={loaded?.sample} />
          <Pipeline
            stages={BRAND_STAGES}
            placement={placement}
            onMove={(id, stage) => setPlacement({ ...placement, [id]: stage })}
            items={creators.map((creator) => ({
              id: creator.handle,
              title: `@${creator.handle}`,
              detail: `${compact(creator.views)} views, ${creator.market}`,
              value: money(creator.cost),
            }))}
          />
        </div>
      )}
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

function CreatorWorkspace({ session, view }: { session: Session; view: View }) {
  const loaded = useResult(() => searchCreator(session.name), session.name);
  const { scanning, finish } = useScan(`app:creator:${session.name}`, true);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [placement, setPlacement] = usePlacement(session);
  const data = loaded?.data;
  const brands = useMemo(() => (data ? rankBrands(data) : []), [data]);
  const label = `@${session.name}`;
  const showing = Boolean(data) && !scanning;

  const stageOf = (entry: RankedBrand) => placement[entry.brand] ?? 0;
  const open = brands.filter((entry) => stageOf(entry) === 0);

  function pitch(entry: RankedBrand) {
    setDraft(creatorPitch(session.name, entry));
    setPlacement({ ...placement, [entry.brand]: Math.max(stageOf(entry), 1) });
  }

  return (
    <>
      {scanning && (
        <Scan
          title={label}
          stages={SCAN_STAGES.creators}
          items={brands.map((entry) => ({ text: entry.top.snippet, term: entry.top.brand }))}
          ready={Boolean(data)}
          onDone={finish}
        />
      )}
      {showing && brands.length === 0 && <Empty term={label} back="/login" />}
      {showing && brands.length > 0 && view === "overview" && (
        <>
          <MoneyHero
            title={label}
            keepCase
            active={showing}
            amount={brands.reduce((sum, entry) => sum + entry.value, 0)}
            stats={[
              { label: "Brands to pitch", value: open.length, prefix: "At least " },
              { label: "Views on those brands", value: brands.reduce((sum, entry) => sum + entry.views, 0), prefix: "At least " },
              { label: "Ad posts removed", value: data?.paidPostsRemoved ?? 0 },
            ]}
          />
          <div className="results-body">
            <SectionHead title="Pitch these first" sample={loaded?.sample} />
            {open.length > 0 ? (
              <BrandCards brands={open.slice(0, 4)} onPitch={pitch} />
            ) : (
              <p className="result-note">Every brand here has been pitched. Check Pitches for replies.</p>
            )}
            <Link className="app-more" to="/app/list">
              See all {brands.length} brands
            </Link>
          </div>
        </>
      )}
      {showing && brands.length > 0 && view === "list" && (
        <div className="results-body">
          <PageTitle title="Brands" sample={loaded?.sample} />
          <BrandCards brands={brands} onPitch={pitch} />
        </div>
      )}
      {showing && brands.length > 0 && view === "pipeline" && (
        <div className="results-body">
          <PageTitle title="Pitches" sample={loaded?.sample} />
          <Pipeline
            stages={CREATOR_STAGES}
            placement={placement}
            onMove={(id, stage) => setPlacement({ ...placement, [id]: stage })}
            items={brands.map((entry) => ({
              id: entry.brand,
              title: entry.brand,
              detail: `${compact(entry.views)} views, ${entry.mentions.length} ${entry.mentions.length === 1 ? "video" : "videos"}`,
              value: money(entry.value),
            }))}
          />
        </div>
      )}
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}
