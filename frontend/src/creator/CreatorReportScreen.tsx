import { Link } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { CreatorReportView } from "../components/CreatorReportView";
import { Loading } from "../components/ResultState";
import { Scan } from "../components/Scan";
import { useScan } from "../components/motion";
import { useResult } from "../components/useResult";
import { SCAN_STAGES } from "../content";
import { CREATOR_REPORT_PATH } from "./availability";
import type { CreatorReport } from "../lib/types";

export async function loadCreatorReport(handle: string): Promise<CreatorReport> {
  const response = await fetch(CREATOR_REPORT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ handle: handle.replace(/^@/, ""), platform: "instagram", maxPosts: 5 }),
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  const body = (await response.json()) as CreatorReport;
  if (!body?.retrieval || !Array.isArray(body.posts) || !Array.isArray(body.entities) || !body.assessment) {
    throw new Error("unexpected response shape");
  }
  return body;
}

export function CreatorReportScreen({
  handle,
  layout,
}: {
  handle: string;
  layout: "page" | "workspace";
}) {
  const loaded = useResult(
    () => loadCreatorReport(handle).then(
      (report) => ({ ok: true as const, report }),
      (reason: unknown) => ({ ok: false as const, message: reason instanceof Error ? reason.message : "request failed" }),
    ),
    handle,
  );
  const { scanning, finish } = useScan(`live:creator:${handle}`, layout === "workspace");
  const items = loaded?.ok
    ? loaded.report.entities.flatMap((entity) => entity.evidence.slice(0, 1).map((evidence) => ({
        text: evidence.snippet ?? entity.name,
        term: entity.name,
        thumbnail: evidence.frameUrl,
      }))).slice(0, 6)
    : [];

  const body = scanning ? (
    <Scan
      key={handle}
      title={`@${handle}`}
      stages={SCAN_STAGES.creators}
      items={items}
      ready={loaded !== null}
      onDone={finish}
    />
  ) : !loaded ? (
    <Loading term={`@${handle}`} />
  ) : loaded.ok === false ? (
    <p className="result-note" data-testid="creator-report-error">
      The creator report did not load ({loaded.message}). Sample brands were not substituted.
    </p>
  ) : (
    <CreatorReportView key={handle} report={loaded.report} sample={false} showPipeline={false} />
  );

  if (layout === "workspace") return <div className="live-panel">{body}</div>;

  return (
    <div className="page">
      <section className="results">
        <Nav audience="creators" />
        <div className="results-body creator-results">
          <header className="creator-report-head">
            <div>
              <Link className="creator-back" to="/for-creators">← Search another creator</Link>
              <p className="creator-eyebrow">Creator report</p>
              <h1>@{handle}</h1>
              <p className="creator-description">Recent video evidence and brand appearances.</p>
            </div>
            <span className="creator-platform">Instagram</span>
          </header>
          <div className="live-panel">{body}</div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
