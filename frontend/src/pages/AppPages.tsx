import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { OutreachDialog, type OutreachDraft } from "../components/OutreachDialog";
import { Pipeline } from "../components/Pipeline";
import { Empty, Failed, Loading } from "../components/ResultState";
import { useResult } from "../components/useResult";
import { searchBrand, searchCreator } from "../lib/api";
import { CHANNEL_LABEL, compact, money } from "../lib/format";
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

function Totals({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="app-totals">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BrandWorkspace({ session, view }: { session: Session; view: View }) {
  const { data, error } = useResult(() => searchBrand(session.name), session.name);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [placement, setPlacement] = usePlacement(session);
  const [market, setMarket] = useState("All");
  const creators = useMemo(() => (data ? rankCreators(data) : []), [data]);

  if (error) return <Failed message={error} back="/login" />;
  if (!data) return <Loading term={session.name} />;
  if (creators.length === 0) return <Empty term={session.name} back="/login" />;

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
      {view === "overview" && (
        <>
          <h1 className="display app-title">{session.name}</h1>
          <Totals
            items={[
              { label: "Creators to contact", value: `At least ${open.length}` },
              { label: "Views on your brand", value: `At least ${compact(creators.reduce((sum, c) => sum + c.views, 0))}` },
              { label: "Cost to buy that reach", value: money(creators.reduce((sum, c) => sum + c.cost, 0)) },
            ]}
          />
          <h2 className="app-heading">Contact these first</h2>
          <CreatorRows creators={open.slice(0, 3)} onContact={contact} />
          <Link className="app-more" to="/app/list">
            See all {creators.length} creators
          </Link>
        </>
      )}
      {view === "list" && (
        <>
          <h1 className="display app-title">Creators</h1>
          <div className="filter" role="group" aria-label="Filter by market">
            {markets.map((item) => (
              <button key={item} type="button" className={item === market ? "active" : undefined} onClick={() => setMarket(item)}>
                {item}
              </button>
            ))}
          </div>
          <CreatorRows creators={shown} onContact={contact} />
        </>
      )}
      {view === "pipeline" && (
        <>
          <h1 className="display app-title">Outreach</h1>
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
        </>
      )}
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

function CreatorRows({ creators, onContact }: { creators: RankedCreator[]; onContact: (creator: RankedCreator) => void }) {
  if (creators.length === 0) return <p className="result-note">Everyone here has been contacted. Check Outreach for replies.</p>;
  return (
    <ul className="app-rows">
      {creators.map((creator) => (
        <li key={creator.handle}>
          <div>
            <strong>@{creator.handle}</strong>
            <span className="sub">
              {compact(creator.followers)} followers, {creator.market}
            </span>
          </div>
          <div className="app-row-quote">
            “{creator.top.snippet}”
            <span className="sub">
              {creator.top.channels.map((channel) => CHANNEL_LABEL[channel]).join(", ")}
              {creator.top.timestamp && ` at ${creator.top.timestamp}`}
            </span>
          </div>
          <div className="app-row-num">
            <strong>{compact(creator.views)}</strong>
            <span className="sub">{money(creator.cost)}</span>
          </div>
          <button type="button" className="pill pill-primary" onClick={() => onContact(creator)}>
            Reach out
          </button>
        </li>
      ))}
    </ul>
  );
}

function CreatorWorkspace({ session, view }: { session: Session; view: View }) {
  const { data, error } = useResult(() => searchCreator(session.name), session.name);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [placement, setPlacement] = usePlacement(session);
  const brands = useMemo(() => (data ? rankBrands(data) : []), [data]);
  const label = `@${session.name}`;

  if (error) return <Failed message={error} back="/login" />;
  if (!data) return <Loading term={label} />;
  if (brands.length === 0) return <Empty term={label} back="/login" />;

  const stageOf = (entry: RankedBrand) => placement[entry.brand] ?? 0;
  const open = brands.filter((entry) => stageOf(entry) === 0);

  function pitch(entry: RankedBrand) {
    setDraft(creatorPitch(session.name, entry));
    setPlacement({ ...placement, [entry.brand]: Math.max(stageOf(entry), 1) });
  }

  return (
    <>
      {view === "overview" && (
        <>
          <h1 className="display display-handle app-title">{label}</h1>
          <Totals
            items={[
              { label: "Brands to pitch", value: `At least ${open.length}` },
              { label: "Views on those brands", value: `At least ${compact(open.reduce((sum, b) => sum + b.views, 0))}` },
              { label: "Worth to those brands", value: money(open.reduce((sum, b) => sum + b.value, 0)) },
            ]}
          />
          <h2 className="app-heading">Pitch these first</h2>
          <BrandRows brands={open.slice(0, 3)} onPitch={pitch} />
          <Link className="app-more" to="/app/list">
            See all {brands.length} brands
          </Link>
        </>
      )}
      {view === "list" && (
        <>
          <h1 className="display app-title">Brands</h1>
          <BrandRows brands={brands} onPitch={pitch} />
        </>
      )}
      {view === "pipeline" && (
        <>
          <h1 className="display app-title">Pitches</h1>
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
        </>
      )}
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

function BrandRows({ brands, onPitch }: { brands: RankedBrand[]; onPitch: (entry: RankedBrand) => void }) {
  if (brands.length === 0) return <p className="result-note">Every brand here has been pitched. Check Pitches for replies.</p>;
  return (
    <ul className="app-rows">
      {brands.map((entry) => (
        <li key={entry.brand}>
          <div>
            <strong>{entry.brand}</strong>
            <span className="sub">
              {entry.mentions.length} {entry.mentions.length === 1 ? "video" : "videos"}
            </span>
          </div>
          <div className="app-row-quote">
            “{entry.top.snippet}”
            <span className="sub">
              {entry.top.channels.map((channel) => CHANNEL_LABEL[channel]).join(", ")}
              {entry.top.timestamp && ` at ${entry.top.timestamp}`}
            </span>
          </div>
          <div className="app-row-num">
            <strong>{money(entry.value)}</strong>
            <span className="sub">{compact(entry.views)} views</span>
          </div>
          <button type="button" className="pill pill-primary" onClick={() => onPitch(entry)}>
            Pitch
          </button>
        </li>
      ))}
    </ul>
  );
}
