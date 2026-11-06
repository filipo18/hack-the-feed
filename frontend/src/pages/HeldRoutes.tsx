import { useParams } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { BrandReport } from "../components/BrandReport";
import { DEMO_LABEL, DEMO_SEARCH } from "../lib/demoFixture";
import { CreatorReportScreen } from "../creator/CreatorReportScreen";

/** Direct URL for the labeled fixture. Not linked from the live search. */
export function DemoBrandSearch() {
  return (
    <div className="page">
      <section className="result-head">
        <Nav audience="brands" />
        <h1 className="display">{DEMO_SEARCH.brand}</h1>
      </section>
      <section className="results">
        <BrandReport data={DEMO_SEARCH} demoLabel={DEMO_LABEL} />
      </section>
      <Footer />
    </div>
  );
}

/** Live creator report. The old sample CreatorResults screen stays unmounted. */
export function CreatorHeld() {
  const handle = decodeURIComponent(useParams().handle ?? "").replace(/^@/, "");
  return <CreatorReportScreen handle={handle} layout="page" />;
}
