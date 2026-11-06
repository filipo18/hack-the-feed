import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BrandReport } from "../components/BrandReport";
import { OutreachDialog, type OutreachDraft } from "../components/OutreachDialog";
import { Pipeline } from "../components/Pipeline";
import { Empty, Loading } from "../components/ResultState";
import { CreatorUnavailable } from "../creator/Unavailable";
import { useResult } from "../components/useResult";
import { searchCreator } from "../lib/api";
import { CHANNEL_LABEL, compact, money } from "../lib/format";
import { creatorPitch } from "../lib/messages";
import { rankBrands, type RankedBrand } from "../lib/rank";
import { useStored, type Session } from "../lib/session";
import { useBrandSearch } from "../lib/useBrandSearch";
import { renderableCreators } from "../lib/contract";
import { disclosureLabel, formatViews } from "../lib/present";

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
          <CreatorUnavailable layout="workspace" handle={session.name} />
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
  const state = useBrandSearch(session.name);
  const [placement, setPlacement] = usePlacement(session);

  if (state.status === "loading") return <Loading term={session.name} />;
  if (state.status === "error") {
    return (
      <div className="result-note" data-testid="search-error" role="alert">
        <p>
          <strong>Search failed</strong>
        </p>
        <p>{state.message}</p>
      </div>
    );
  }

  const creators = renderableCreators(state.data.rankedCreators).creators;
  const title = view === "pipeline" ? "Outreach" : view === "list" ? "Creators" : session.name;

  return (
    <>
      <p className="sample-tag workspace-tag">Demo workspace · real search · not an account</p>
      <h1 className="display app-title">{title}</h1>
      <p className="results-meta">Stages stay in this browser. A draft is not sent.</p>
      <BrandReport data={state.data} />
      {view === "pipeline" && (
        <Pipeline
          stages={BRAND_STAGES}
          placement={placement}
          onMove={(id, stage) => setPlacement({ ...placement, [id]: stage })}
          items={creators.map((creator) => ({
            id: creator.creatorKey,
            title: creator.handle ? `@${creator.handle}` : creator.creatorKey,
            detail: `${creator.platform || "platform unknown"} · ${disclosureLabel(creator.disclosure)}`,
            value: formatViews(creator.sumViews, creator.viewsIncomplete),
          }))}
        />
      )}
    </>
  );
}

/** Unmounted PR5 creator workspace. It still loads sample rows. Do not render it. */
function CreatorWorkspace({ session, view }: { session: Session; view: View }) {
  const loaded = useResult(() => searchCreator(session.name), session.name);
  const data = loaded?.data;
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [placement, setPlacement] = usePlacement(session);
  const brands = useMemo(() => (data ? rankBrands(data) : []), [data]);
  const label = `@${session.name}`;

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
      {loaded?.sample && <p className="sample-tag workspace-tag">Sample data</p>}
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
