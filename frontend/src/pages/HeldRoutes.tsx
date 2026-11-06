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
      <section className="results">
        <Nav audience="brands" />
        <div className="results-body">
          <h1 className="display live-title">{DEMO_SEARCH.brand}</h1>
          <div className="live-panel">
            <BrandReport data={DEMO_SEARCH} demoLabel={DEMO_LABEL} />
          </div>
        </div>
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
