import { expect, test, type Page, type Request } from "@playwright/test";

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/i.test(message.text())) errors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    expect(url.origin, request.url()).toBe("http://127.0.0.1:8765");
  });
});

test.afterEach(() => {
  expect(errors, errors.join("\n")).toEqual([]);
});

function contract(overrides: Record<string, unknown>) {
  return {
    brand: "Ryanair",
    assessment: "complete",
    assessmentReason: null,
    gmiModel: "configured-by-env",
    warnings: [],
    channels: [{ channel: "written", status: "ok", warning: null, retrieved: 1 }],
    rankedCreators: [],
    heldOut: [],
    unassessedCreators: [],
    ...overrides,
  };
}

async function submitBrand(page: Page, brand = "Ryanair") {
  await page.goto("/for-brands");
  await page.locator("#hero-search").fill(brand);
  await page.locator("form.search").first().locator("button[type=submit]").click();
}

async function fulfillSearch(page: Page, body: unknown, status = 200) {
  await page.route("**/api/search", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

test("deep link, assets, and a real unconfigured search stay honest", async ({ page }) => {
  await page.goto("/for-brands");
  const src = await page.locator("script[type='module']").getAttribute("src");
  expect(src).toMatch(/^\/assets\//);
  const asset = await page.request.get(src!);
  expect(asset.ok()).toBeTruthy();
  expect(asset.headers()["content-type"] ?? "").toContain("javascript");

  const health = await page.request.get("/health");
  expect(await health.json()).toMatchObject({ status: "ok", orianeConfigured: false, gmiConfigured: false });

  await page.goto("/brands/Ryanair");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Ryanair" })).toBeVisible();
  await expect(page.getByTestId("assessment")).toContainText("Search did not run");
  await expect(page.getByText("sample.sofia")).toHaveCount(0);
  await expect(page.getByText(/ad marker/i)).toHaveCount(0);
});

test("the brand form posts /api/search and does not invent creators", async ({ page }) => {
  const seen = page.waitForRequest((request) => request.url().endsWith("/api/search") && request.method() === "POST");
  await submitBrand(page, "Ryanair");
  const request = await seen;
  expect(request.postDataJSON()).toEqual({
    brand: "Ryanair",
    aliases: [],
    platforms: ["instagram", "tiktok"],
  });
  await expect(page.getByTestId("assessment")).toContainText("ORIANE_API_KEY");
  await expect(page.getByTestId("ranked-creators")).toHaveCount(0);
});

test("provider failure, malformed output, missing views, and an empty sample stay honest", async ({ page }) => {
  await fulfillSearch(page, { detail: "Oriane provider timed out." }, 502);
  await submitBrand(page);
  await expect(page.getByTestId("search-error")).toContainText("Oriane provider timed out.");
  await expect(page.getByText("sample.sofia")).toHaveCount(0);

  await page.unroute("**/api/search");
  await fulfillSearch(
    page,
    contract({
      assessment: "unassessed",
      assessmentReason: "malformed_model_response",
      rankedCreators: [],
      unassessedCreators: [
        { creatorKey: "tiktok:pending", platform: "tiktok", handle: "fixture.pending", disclosure: "unknown", judgmentSource: "pending" },
      ],
    }),
  );
  await submitBrand(page);
  await expect(page.getByTestId("assessment")).toContainText("could not be used");
  await expect(page.getByTestId("unassessed")).toContainText("fixture.pending");
  await expect(page.getByTestId("ranked-creators")).toHaveCount(0);

  await page.unroute("**/api/search");
  await fulfillSearch(
    page,
    contract({
      warnings: ["written: Oriane provider timed out. This channel has no rows."],
      channels: [{ channel: "written", status: "failed", warning: "Oriane provider timed out. This channel has no rows.", retrieved: 0 }],
      rankedCreators: [
        {
          creatorKey: "instagram:one",
          platform: "instagram",
          handle: "fixture.creator",
          sumViews: null,
          viewsIncomplete: true,
          relevantPostCount: 1,
          disclosure: "unknown",
          why: "The caption names the brand once.",
          posts: [{ evidenceLabels: ["caption"], countsTowardReach: true, media: [{ transcript: "Flew Ryanair." }] }],
        },
      ],
    }),
  );
  await submitBrand(page);
  await expect(page.getByTestId("warnings")).toContainText("timed out");
  await expect(page.getByTestId("ranked-creators")).toContainText("fixture.creator");
  await expect(page.getByTestId("ranked-creators")).toContainText("Views unknown");
  await expect(page.getByTestId("ranked-creators")).toContainText("The caption names the brand once.");
  await expect(page.getByTestId("ranked-creators")).toContainText("Caption");

  await page.unroute("**/api/search");
  await fulfillSearch(page, contract({ assessment: "not_run", assessmentReason: "no_posts", channels: [{ channel: "written", status: "ok", warning: null, retrieved: 0 }] }));
  await submitBrand(page);
  await expect(page.getByTestId("assessment")).toContainText("No posts in the retrieved sample");
});

test("the mocked brand fixture is labeled and the creator route does not use sample rows", async ({ page }) => {
  const calls: Request[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) calls.push(request);
  });
  await page.goto("/demo/brand-search");
  await expect(page.getByTestId("demo-banner")).toContainText("MOCKED FIXTURE");
  await expect(page.getByTestId("ranked-creators")).toContainText("fixture.creator");
  await expect(page.getByTestId("ranked-creators")).toContainText("Views unknown");
  await expect(page.getByTestId("held-out")).toContainText("fixturebrand");
  await expect(page.getByTestId("unassessed")).toContainText("fixture.pending");
  await expect(page.getByText(/ad marker/i)).toHaveCount(0);
  expect(calls).toEqual([]);

  await page.goto("/creators/sample.sofia");
  await expect(page.getByTestId("creator-report")).toContainText("Oriane is not configured");
  await expect(page.getByTestId("creator-report")).toContainText("Live vision validation is blocked");
  await expect(page.getByText("sample.kenji")).toHaveCount(0);
  await expect(page.getByText("Sample data")).toHaveCount(0);
  await expect(page.getByText("Joke invoice")).toHaveCount(0);
  expect(calls.map((request) => new URL(request.url()).pathname)).toContain("/api/creator-report");
});

test("a stubbed creator report gates the joke invoice and does not send a pitch", async ({ page }) => {
  await page.route("**/api/creator-report", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        handle: "stub.creator",
        platform: "instagram",
        source: "oriane",
        historyComplete: false,
        paymentOwed: false,
        confirmationRequired: true,
        illustrativeCpm: 10,
        cpmSource: "request",
        invoice: null,
        followers: null,
        textWindowTruncated: false,
        visionFramesSent: 0,
        retrieval: {
          status: "ok",
          message: null,
          indexedTotalCount: 1,
          returnedCount: 1,
          cap: 5,
          offset: 0,
          paginationComplete: true,
          earliestPublishedAt: "2026-09-20T00:00:00.000Z",
          latestPublishedAt: "2026-09-20T00:00:00.000Z",
        },
        posts: [
          {
            id: "cnt_stub",
            platform: "instagram",
            platformId: "stub-post",
            publishedAt: "2026-09-20T00:00:00.000Z",
            viewsCount: 1000,
            transcriptState: "null",
            ocrLineCount: 0,
            frameCount: 0,
            disclosure: "unknown",
          },
        ],
        entities: [
          {
            id: "brand:stubco",
            name: "Stubco",
            entityType: "brand",
            aliases: [],
            status: "candidate",
            disclosure: "unknown",
            reviewStatus: "unreviewed",
            matchingPostCount: 1,
            matchingPosts: [{ platformId: "stub-post", publishedAt: "2026-09-20T00:00:00.000Z", views: 1000 }],
            evidence: [
              {
                postId: "cnt_stub",
                platformId: "stub-post",
                publishedAt: "2026-09-20T00:00:00.000Z",
                views: 1000,
                field: "caption",
                snippet: "hello Stubco",
                timestampSeconds: null,
                frameId: null,
                frameUrl: null,
                source: "text",
                reviewStatus: "unreviewed",
              },
            ],
            viewsNote: "Each view count is that post once.",
          },
        ],
        assessment: { text: "complete", vision: "blocked", reason: "model_vision_not_confirmed" },
      }),
    }),
  );
  await page.goto("/creators/stub.creator");
  await expect(page.getByRole("heading", { name: "Joke invoice" })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm appearance" }).click();
  await expect(page.getByRole("heading", { name: "Joke invoice" })).toBeVisible();
  await expect(page.getByText("Not a bill and not a debt")).toBeVisible();
  await page.getByRole("button", { name: "Copy pitch" }).click();
  await expect(page.getByRole("heading", { name: /Nothing is sent/ })).toBeVisible();
});

test("demo access does not pretend to be a password check", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Demo access" })).toBeVisible();
  await expect(page.getByText("does not check a password")).toBeVisible();
  await page.getByRole("button", { name: "Creator" }).click();
  await expect(page.getByRole("heading", { name: "Creator report" })).toBeVisible();
});
