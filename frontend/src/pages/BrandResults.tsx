import { useParams } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { BrandReport } from "../components/BrandReport";
import { Scan } from "../components/Scan";
import { Loading } from "../components/ResultState";
import { SCAN_STAGES } from "../content";
import { useBrandSearch } from "../lib/useBrandSearch";

export function BrandResults() {
  const brand = decodeURIComponent(useParams().brand ?? "");
  const state = useBrandSearch(brand);

  return (
    <div className="page">
      {state.status === "loading" && (
        <Scan title={brand} stages={SCAN_STAGES.brands} items={[]} ready={false} onDone={() => undefined} />
      )}
      <section className="result-head">
        <Nav audience="brands" />
        <h1 className="display">{brand}</h1>
      </section>
      <section className="results">
        {state.status === "loading" && <Loading term={brand} />}
        {state.status === "error" && (
          <div className="result-note" data-testid="search-error" role="alert">
            <p>
              <strong>Search failed</strong>
            </p>
            <p>{state.message}</p>
          </div>
        )}
        {state.status === "ready" && <BrandReport data={state.data} />}
      </section>
      <Footer />
    </div>
  );
}
