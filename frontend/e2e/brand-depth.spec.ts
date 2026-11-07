import { expect, test } from "@playwright/test";

const post = (id: string, context = "product_use", views = 100) => ({
  postKey: id, viewsCount: views, countsTowardReach: true, assessment: "complete", context,
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
