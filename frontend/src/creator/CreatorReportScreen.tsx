import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { CreatorReportView } from "../components/CreatorReportView";
import { Loading } from "../components/ResultState";
import { useResult } from "../components/useResult";
import { CREATOR_REPORT_PATH } from "./availability";
import type { CreatorReport, ReportPlatform } from "../lib/types";

function platformFrom(value: string | null): ReportPlatform {
  if (value === "tiktok" || value === "youtube") return value;
  return "instagram";
}

export async function loadCreatorReport(handle: string, platform: ReportPlatform): Promise<CreatorReport> {
  const response = await fetch(CREATOR_REPORT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ handle: handle.replace(/^@/, ""), platform, maxPosts: 5 }),
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
  const [params, setParams] = useSearchParams();
  const [workspacePlatform, setWorkspacePlatform] = useState<ReportPlatform>("instagram");
  const platform = layout === "page" ? platformFrom(params.get("platform")) : workspacePlatform;
  const loaded = useResult(
    () => loadCreatorReport(handle, platform).then(
      (report) => ({ ok: true as const, report }),
      (reason: unknown) => ({ ok: false as const, message: reason instanceof Error ? reason.message : "request failed" }),
    ),
    `${handle}:${platform}`,
  );

  function onPlatform(next: ReportPlatform) {
    if (layout === "workspace") {
      setWorkspacePlatform(next);
      return;
    }
    setParams(next === "instagram" ? {} : { platform: next });
  }

  const body = !loaded ? (
    <Loading term={`@${handle}`} />
  ) : loaded.ok === false ? (
    <p className="result-note" data-testid="creator-report-error">
      The creator report did not load ({loaded.message}). Sample brands were not substituted.
    </p>
  ) : (
    <CreatorReportView report={loaded.report} sample={false} platform={platform} onPlatform={onPlatform} showPipeline={false} />
  );

  if (layout === "workspace") return <div className="live-panel">{body}</div>;

  return (
    <div className="page">
      <section className="results">
        <Nav audience="creators" />
        <div className="results-body">
          <h1 className="display live-title display-handle">@{handle}</h1>
          <div className="live-panel">{body}</div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
