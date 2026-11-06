import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_LABEL, DEMO_SEARCH } from "./demoFixture";
import { disclosureLabel, formatViews, assessmentCopy } from "./present";
import { CREATOR_REPORT_READY } from "../creator/availability";

describe("honest presentation", () => {
  it("names each failed assessment without a success state", () => {
    expect(assessmentCopy("oriane_not_configured")?.text).toContain("ORIANE_API_KEY");
    expect(assessmentCopy("gmi_not_configured")?.text).toContain("GMI_API_KEY");
    expect(assessmentCopy("gmi_error")?.text).toContain("unassessed");
    expect(assessmentCopy("malformed_model_response")?.text).toContain("malformed");
    expect(assessmentCopy("no_posts")?.text).toContain("does not prove");
  });

  it("keeps a missing view count unknown", () => {
    expect(formatViews(null, true)).toBe("Views unknown");
    expect(formatViews(undefined, false)).toBe("Views unknown");
    expect(formatViews(1200, false)).toBe("1.2K");
    expect(formatViews(1200, true)).toContain("missing its view count");
  });

  it("does not call disclosed or unknown unpaid", () => {
    expect(disclosureLabel("disclosed")).toBe("Disclosed");
    expect(disclosureLabel("unknown")).toBe("Disclosure unknown");
    expect(disclosureLabel("disclosed").toLowerCase()).not.toContain("unpaid");
    expect(disclosureLabel("unknown").toLowerCase()).not.toContain("unpaid");
  });

  it("marks the brand fixture and mounts the creator report instead of sample rows", () => {
    expect(DEMO_LABEL).toContain("MOCKED FIXTURE");
    expect(DEMO_SEARCH.rankedCreators.some((creator) => creator.sumViews == null)).toBe(true);
    expect(DEMO_SEARCH.heldOut.length).toBeGreaterThan(0);
    expect(DEMO_SEARCH.unassessedCreators.length).toBeGreaterThan(0);
    expect(CREATOR_REPORT_READY).toBe(true);
    const unavailable = readFileSync(new URL("../creator/Unavailable.tsx", import.meta.url), "utf8");
    expect(unavailable).not.toContain("sample.sofia");
    const main = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
    expect(main).not.toContain("<CreatorResults");
    expect(main).toContain("<CreatorHeld");
    const app = readFileSync(new URL("../pages/AppPages.tsx", import.meta.url), "utf8");
    expect(app).not.toContain("<CreatorWorkspace");
    expect(app).toContain("<CreatorReportScreen");
  });
});
