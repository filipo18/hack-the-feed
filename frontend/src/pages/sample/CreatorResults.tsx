import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BrandCards } from "../../components/Cards";
import { Footer } from "../../components/Footer";
import { MoneyHero } from "../../components/MoneyHero";
import { Nav } from "../../components/Nav";
import { OutreachDialog, type OutreachDraft } from "../../components/OutreachDialog";
import { Empty } from "../../components/ResultState";
import { Scan } from "../../components/Scan";
import { useScan } from "../../components/motion";
import { useResult } from "../../components/useResult";
import { SCAN_STAGES } from "../../content";
import { searchCreator } from "../../lib/api";
import { money } from "../../lib/format";
import { creatorPitch } from "../../lib/messages";
import { rankBrands } from "../../lib/rank";

export function CreatorResults() {
  const handle = decodeURIComponent(useParams().handle ?? "").replace(/^@/, "");
  const loaded = useResult(() => searchCreator(handle), handle);
  const { scanning, finish } = useScan(`creator:${handle}`, false);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const data = loaded?.data;
  const brands = useMemo(() => (data ? rankBrands(data) : []), [data]);
  const showing = Boolean(data) && !scanning;

  return (
    <div className="page">
      {scanning && (
        <Scan
          title={`@${handle}`}
          stages={SCAN_STAGES.creators}
          items={brands.map((entry) => ({ text: entry.top.snippet, term: entry.top.brand, thumbnail: entry.top.thumbnail }))}
          ready={Boolean(data)}
          onDone={finish}
        />
      )}
      <section className="results">
        <Nav audience="creators" />
        {showing && brands.length === 0 && <Empty term={`@${handle}`} back="/for-creators" />}
        {showing && brands.length > 0 && (
          <>
            <MoneyHero
              title={`@${handle}`}
              keepCase
              active={showing}
              amount={brands.reduce((sum, entry) => sum + entry.value, 0)}
              line={(shown) => `${money(shown)} on the table.`}
              note="What this reach would cost to buy. It is an estimate, not money owed."
              stats={[
                { label: "Brands in your videos", value: brands.length, prefix: "At least " },
                { label: "Views on those brands", value: brands.reduce((sum, entry) => sum + entry.views, 0), prefix: "At least " },
                { label: "Ad posts removed", value: data?.paidPostsRemoved ?? 0 },
              ]}
            />
            <div className="results-body">
              <div className="results-head">
                <h2>Pitch these first</h2>
                {loaded?.sample && <span className="sample-tag">Sample data</span>}
              </div>
              <BrandCards brands={brands} onPitch={(entry) => setDraft(creatorPitch(handle, entry))} />
            </div>
          </>
        )}
      </section>
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
      <Footer />
    </div>
  );
}
