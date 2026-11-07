import { expect, test } from "@playwright/test";

const post = (id: string, context = "product_use", views = 100) => ({
  postKey: id, viewsCount: views, countsTowardReach: true, assessment: "complete", context,
  canonicalPostUrl: `https://www.instagram.com/reel/${id}/`,
  caption: "I run in Nike shoes.", why: "The creator describes using Nike running shoes.",
  verdict: "relevant", holdout: null, evidenceLabels: ["caption"],
});
const creator = (handle: string, posts: ReturnType<typeof post>[]) => ({
  creatorKey: `instagram:${handle}`, handle, platform: "instagram", posts,
  relevantPostCount: posts.length, sumViews: posts.reduce((sum, p) => sum + p.viewsCount, 0),
});
const reply = (rankedCreators: ReturnType<typeof creator>[]) => ({
  brand: "Nike", assessment: "complete", assessmentReason: null, warnings: [], channels: [],
  rankedCreators, heldOut: [], unassessedCreators: [],
});

test.use({ reducedMotion: "reduce" });

test("matching videos have individual links and tag filtering works with sorting", async ({ page }) => {
  const rows = [
    creator("reviewer", [post("review-one", "review", 100), post("recommend-one", "recommendation", 200)]),
    creator("viral", [post("mention-one", "mention", 1000000)]),
    creator("unknown", [{ ...post("unknown-one", "unknown", 50), canonicalPostUrl: "javascript:alert(1)" }]),
  ];
  await page.route("**/api/search", route => route.fulfill({ json: reply(rows) }));
  await page.route("**/api/search/creator", route => {
    const { handle } = route.request().postDataJSON();
    return route.fulfill({ json: { ...reply(rows.filter(row => row.handle === handle)), depth: { status: "complete", handle, platform: "instagram", hasMore: false } } });
  });
  await page.goto("/brands/Nike");
  const cards = page.getByTestId("ranked-creators").locator(".card");
  await expect(cards).toHaveCount(3);
  await expect(page.locator(".depth-progress")).toContainText("Deeper search finished");
  const reviewer = cards.filter({ hasText: "@reviewer" });
  await reviewer.locator(".card-matches summary").click();
  const links = reviewer.getByRole("link", { name: /Open video/ });
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute("href", "https://www.instagram.com/reel/recommend-one/");
  await expect(links.nth(1)).toHaveAttribute("href", "https://www.instagram.com/reel/review-one/");
  await expect(links.first()).toHaveAttribute("target", "_blank");
  const unknown = cards.filter({ hasText: "@unknown" });
  await unknown.locator(".card-matches summary").click();
  await expect(unknown.locator(".match-post a")).toHaveCount(0);
  await expect(unknown.locator(".match-post")).toContainText("Context unknown");

  const filter = page.getByLabel("Filter by tag");
  await filter.selectOption("Review");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("@reviewer");
  await page.getByLabel("Sort by").selectOption("views");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("@reviewer");
  await filter.selectOption("Repeated mentions");
  await expect(cards).toHaveCount(1);
  await filter.selectOption("");
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("@viral");
  await expect(page.getByText("About these results", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const controls = await page.locator(".match-controls").boundingBox();
  const progress = await page.locator(".depth-progress").boundingBox();
  expect(progress!.y).toBeGreaterThanOrEqual(controls!.y + controls!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("shows initial results, merges deeper evidence, switches sort, and preserves failed checks", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/search", route => route.fulfill({ json: reply([
    null as never,
    creator("viral", [post("viral-one", "mention", 1000000)]),
    creator("runner", [post("runner-one")]),
    creator("unavailable", [post("unavailable-one", "unknown", 50)]),
  ]) }));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/search/creator", async route => {
    const { handle } = route.request().postDataJSON();
    await gate;
    if (handle === "unavailable") return route.fulfill({ status: 502, json: { detail: "Provider timed out" } });
    const posts = handle === "runner" ? [post("runner-one"), post("runner-two", "review", 200)] : [post("viral-one", "mention", 1000000)];
    return route.fulfill({ json: { ...reply([creator(handle, posts)]), depth: { status: "complete", handle, platform: "instagram", hasMore: false } } });
  });
  await page.goto("/brands/Nike");
  const cards = page.getByTestId("ranked-creators").locator(".card");
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("@runner");
  await expect(page.locator(".depth-progress")).toContainText("0 of 3");
  release();
  await expect(page.locator(".depth-progress")).toContainText("Deeper search finished");
  await expect(page.locator(".depth-progress")).toContainText("1 checks were incomplete");
  const runner = cards.filter({ hasText: "@runner" });
  await expect(runner).toContainText("2 matching posts found");
  await expect(runner.locator(".card-amount")).toContainText("300");
  await runner.locator(".card-matches summary").click();
  await expect(runner.locator(".match-post")).toHaveCount(2);
  await expect(runner.locator(".match-post").first()).toContainText("Review");
  await expect(cards.filter({ hasText: "@unavailable" })).toContainText("1 matching post found");
  await page.getByLabel("Sort by").selectOption("views");
  await expect(cards.first()).toContainText("@viral");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
