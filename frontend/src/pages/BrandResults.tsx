import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CreatorCards } from "../components/Cards";
import { Footer } from "../components/Footer";
import { MoneyHero } from "../components/MoneyHero";
import { Nav } from "../components/Nav";
import { OutreachDialog, type OutreachDraft } from "../components/OutreachDialog";
import { Empty } from "../components/ResultState";
import { Scan } from "../components/Scan";
import { useScan } from "../components/motion";
import { useResult } from "../components/useResult";
import { SCAN_STAGES } from "../content";
import { searchBrand } from "../lib/api";
import { brandOutreach } from "../lib/messages";
import { rankCreators } from "../lib/rank";

export function BrandResults() {
  const brand = decodeURIComponent(useParams().brand ?? "");
  const loaded = useResult(() => searchBrand(brand), brand);
  const { scanning, finish } = useScan(`brand:${brand}`, false);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const data = loaded?.data;
  const creators = useMemo(() => (data ? rankCreators(data) : []), [data]);
  const showing = Boolean(data) && !scanning;

  return (
    <div className="page">
      {scanning && (
        <Scan
          title={brand}
          stages={SCAN_STAGES.brands}
          items={creators.map((creator) => ({ text: creator.top.snippet, term: creator.top.brand }))}
          ready={Boolean(data)}
          onDone={finish}
        />
      )}
      <section className="results">
        <Nav audience="brands" />
        {showing && creators.length === 0 && <Empty term={brand} back="/for-brands" />}
        {showing && creators.length > 0 && (
          <>
            <MoneyHero
              title={brand}
              active={showing}
              amount={creators.reduce((sum, creator) => sum + creator.cost, 0)}
              stats={[
                { label: "Creators with no ad marker", value: creators.length, prefix: "At least " },
                { label: "Views on your brand", value: creators.reduce((sum, creator) => sum + creator.views, 0), prefix: "At least " },
                { label: "Ad posts removed", value: data?.paidPostsRemoved ?? 0 },
              ]}
            />
            <div className="results-body">
              <div className="results-head">
                <h2>Reach out to these first</h2>
                {loaded?.sample && <span className="sample-tag">Sample data</span>}
              </div>
              <CreatorCards creators={creators} onContact={(creator) => setDraft(brandOutreach(brand, creator))} />
            </div>
          </>
        )}
      </section>
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
      <Footer />
    </div>
  );
}
