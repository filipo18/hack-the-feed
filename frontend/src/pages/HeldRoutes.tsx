import { useParams } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { BrandReport } from "../components/BrandReport";
import { DEMO_LABEL, DEMO_SEARCH } from "../lib/demoFixture";
import { CreatorUnavailable } from "../creator/Unavailable";

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

/** Mounted instead of the PR5 creator results screen, which still falls back to sample rows. */
export function CreatorHeld() {
  const handle = decodeURIComponent(useParams().handle ?? "").replace(/^@/, "");
  return <CreatorUnavailable handle={handle} />;
}
