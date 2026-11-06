import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { CREATOR_REPORT_READY } from "./availability";

export function CreatorUnavailable({
  handle,
  layout = "page",
}: {
  handle?: string;
  layout?: "page" | "workspace";
}) {
  if (CREATOR_REPORT_READY) {
    throw new Error("Creator UI was marked ready without a mounted report component.");
  }
  const body = (
    <div className="result-note" data-testid="creator-unavailable">
      <p>
        <strong>Creator report is not available yet.</strong>
      </p>
      <p>
        This screen is not a live search. Indexed posts, review, illustrative value, a joke invoice, and a pitch are
        not connected. No sample rows are shown in their place.
      </p>
      {handle ? <p>Nothing was looked up for @{handle}.</p> : null}
    </div>
  );
  if (layout === "workspace") return body;
  return (
    <div className="page">
      <section className="result-head">
        <Nav audience="creators" />
        <h1 className="display display-handle">{handle ? `@${handle}` : "Creators"}</h1>
      </section>
      <section className="results">{body}</section>
      <Footer />
    </div>
  );
}
