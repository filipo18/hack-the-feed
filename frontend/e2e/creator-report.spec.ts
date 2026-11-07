import { expect, test } from "@playwright/test";
import type { CreatorEntity, CreatorReport } from "../src/lib/types";

function entity(name: string, entityType: CreatorEntity["entityType"], views: number | null = 1400000): CreatorEntity {
  return {
    id: `${entityType}:${name}`, name, entityType, aliases: [], status: "candidate",
    disclosure: "unknown", reviewStatus: "unreviewed", matchingPostCount: 1,
    matchingPosts: [{ platformId: "post-one", publishedAt: null, views }],
    evidence: [{ postId: "one", platformId: "post-one", publishedAt: null, views,
      field: "on_screen_text", snippet: name, timestampSeconds: null, frameId: null,
      frameUrl: null, source: "text", reviewStatus: "unreviewed" }],
    viewsNote: "Each post counted once.",
  };
}

function report(platform = "instagram"): CreatorReport {
  return {
    handle: "test.creator", platform: platform as CreatorReport["platform"], source: "oriane",
    historyComplete: false, paymentOwed: false, confirmationRequired: true,
    illustrativeCpm: null, cpmSource: null, invoice: null, followers: null,
    textWindowTruncated: false, visionFramesSent: 0,
    retrieval: { status: "ok", message: null, indexedTotalCount: 1, returnedCount: 1,
      cap: 5, offset: 0, paginationComplete: true, earliestPublishedAt: "2026-09-20", latestPublishedAt: "2026-09-20" },
    posts: [{ id: "one", platform, platformId: "post-one", publishedAt: null,
      viewsCount: 1400000, transcriptState: "null", ocrLineCount: 1, frameCount: 1, disclosure: "unknown" }],
    entities: [entity("77x.world", "brand"), entity("YouTube", "platform_distribution"),
      entity("LAKERS", "team"), entity("jvando_", "person"), entity("Unknown product", "product", null)],
    assessment: { text: "complete", vision: "blocked", reason: "model_vision_not_confirmed" },
  };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/creator-report", (route) => route.fulfill({
    json: report(route.request().postDataJSON().platform),
  }));
});

test("shows views and groups context in an Instagram-only report", async ({ page }) => {
  await page.goto("/creators/test.creator");
  const brands = page.getByRole("region", { name: "Brands and products" });
  await expect(brands).toContainText("1.4M");
  await expect(brands).toContainText("Post views");
  await expect(brands).toContainText("Views unknown");
  await expect(brands).not.toContainText("YouTube");
  await expect(brands).not.toContainText("LAKERS");
  await expect(page.getByRole("heading", { name: "LAKERS" })).not.toBeVisible();
  await page.getByText("Other mentions (3)", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "LAKERS" })).toBeVisible();
  await expect(page.getByTestId("other-mentions").getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("creator-assessment")).toContainText("Visual analysis is not enabled");
  await expect(page.getByTestId("creator-report")).not.toContainText("Live vision validation is blocked");
  await page.getByRole("button", { name: "Confirm appearance" }).first().click();
  await expect(page.getByRole("button", { name: "Confirmed" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Joke invoice" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Platform" })).toHaveCount(0);
});

test("creator cards fit a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/creators/test.creator");
  await expect(page.getByRole("region", { name: "Brands and products" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByLabel("Disclosure for 77x.world")).toBeVisible();
});

test("creator search uses the scan animation until the report is ready", async ({ page }) => {
  await page.clock.install();
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/creator-report", async (route) => {
    await ready;
    await route.fulfill({ json: report() });
  });
  await page.goto("/creators/test.creator");
  await expect(page.locator(".scan")).toBeVisible();
  await expect(page.locator(".scan-title")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".scan-stage")).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.clock.runFor(5000);
  await expect(page.locator(".scan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
  await expect(page.getByTestId("creator-report")).toHaveCount(0);
  release();
  await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator(".scan")).toHaveCount(0);
  await expect(page.getByTestId("creator-report")).toBeVisible();
});

test("a failed creator search exits the animation and shows the error", async ({ page }) => {
  await page.route("**/api/creator-report", (route) => route.fulfill({ status: 502, json: { detail: "unavailable" } }));
  await page.goto("/creators/test.creator");
  await expect(page.locator(".scan")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByTestId("creator-report-error")).toBeVisible();
  await expect(page.locator(".scan")).toHaveCount(0);
});

test("creator search respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/creators/test.creator");
  await expect(page.getByTestId("creator-report")).toBeVisible();
  await expect(page.locator(".scan")).toHaveCount(0);
});

for (const platform of ["tiktok", "youtube"]) {
  test(`old ${platform} links still load Instagram`, async ({ page }) => {
    const request = page.waitForRequest("**/api/creator-report");
    await page.goto(`/creators/test.creator?platform=${platform}`);
    expect((await request).postDataJSON().platform).toBe("instagram");
    await expect(page.getByRole("group", { name: "Platform" })).toHaveCount(0);
  });
}
