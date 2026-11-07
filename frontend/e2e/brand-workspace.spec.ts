import { expect, test, type Page } from "@playwright/test";

const creator = {
  creatorKey: "instagram:alice", platform: "instagram", handle: "alice", sumViews: 1200,
  relevantPostCount: 1, disclosure: "unknown", why: "Shows Birkenstock sandals in a review.",
  posts: [{ countsTowardReach: true, canonicalPostUrl: "https://www.instagram.com/p/example/", evidenceLabels: ["caption"], media: [{ transcript: "My Birkenstock sandals." }] }],
};
const report = (overrides = {}) => ({
  brand: "Birkenstock", assessment: "complete", assessmentReason: null, warnings: [],
  channels: [{ channel: "written", status: "ok", retrieved: 1 }],
  rankedCreators: [], heldOut: [], unassessedCreators: [], ...overrides,
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Your brand").fill("Birkenstock");
  await page.getByRole("button", { name: "Open my dashboard" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  page.on("pageerror", error => { throw error; });
});

test("empty overview explains exclusions and offers recovery", async ({ page }) => {
  await page.route("**/api/search", route => route.fulfill({ json: report({
    warnings: ["One search channel could not be read."],
    heldOut: [{ ...creator, holdoutReason: "owned_account" }],
    unassessedCreators: [{ ...creator, creatorKey: "instagram:pending", handle: "pending" }],
  }) }));
  await login(page);
  await expect(page.getByRole("heading", { name: "No creators ranked in this sample" })).toBeVisible();
  await expect(page.getByText("One search channel could not be read.")).toBeVisible();
  await expect(page.getByText("Brand's own account")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unassessed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run again" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Change brand", exact: true })).toBeVisible();
});

test("deeper matches update the view ranking and the completed report survives reload", async ({ page }) => {
  let calls = 0;
  const alice = { ...creator, posts: [{ postKey: "alice-one", countsTowardReach: true, viewsCount: 1200 }] };
  const bob = { ...creator, creatorKey: "instagram:bob", handle: "bob", sumViews: 10, posts: [{ postKey: "bob-one", countsTowardReach: true, viewsCount: 10 }] };
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/search", route => {
    calls++;
    return route.fulfill({ json: report({ rankedCreators: [alice, bob] }) });
  });
  await page.route("**/api/search/creator", async route => {
    const { handle } = route.request().postDataJSON();
    await pending;
    if (handle === "alice") return route.fulfill({ status: 502, json: { detail: "Deeper check unavailable" } });
    return route.fulfill({ json: report({
      rankedCreators: [{ ...bob, posts: [...bob.posts, { postKey: "bob-two", countsTowardReach: true, viewsCount: 2000, verdict: "relevant", assessment: "complete" }] }],
      depth: { status: "complete", handle: "bob", platform: "instagram", hasMore: false },
    }) });
  });
  await login(page);
  const cards = page.locator(".workspace-cards .card");
  await expect(cards.first()).toContainText("@alice");
  release();
  await expect(page.getByRole("button", { name: "Run again", exact: true })).toBeEnabled();
  await expect(cards.first()).toContainText("@bob");
  await expect(cards.first()).toContainText("2 matching posts found");
  await expect(cards.filter({ hasText: "@alice" })).toContainText("Deeper check unavailable");
  await page.reload();
  await expect(cards.first()).toContainText("@bob");
  expect(calls).toBe(1);
});

test("saved evidence, edited drafts and outreach survive empty searches and reloads", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/search", route => {
    calls++;
    return route.fulfill({ json: report({ rankedCreators: calls === 1 ? [creator] : [] }) });
  });
  await login(page);
  await page.getByRole("button", { name: "Save creator: @alice", exact: true }).click();
  await page.getByRole("link", { name: "Creators", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
  await page.getByRole("button", { name: "Draft message: @alice" }).click();
  await page.getByLabel("Message", { exact: true }).fill("Hi Alice, can we discuss a collaboration?");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("link", { name: "Outreach", exact: true }).click();
  await expect(page.getByRole("tabpanel").getByText("Hi Alice, can we discuss a collaboration?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await page.getByRole("tab", { name: "1 Contacted", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
  expect(calls).toBe(1);
  await page.reload();
  await page.getByRole("tab", { name: "1 Contacted", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Run again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No creators ranked in this sample" })).toBeVisible();
  await page.getByRole("link", { name: "Creators", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
  await page.getByRole("button", { name: "Draft message: @alice" }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Hi Alice, can we discuss a collaboration?");
});

test("loading stays visible with reduced motion and an initial failure can recover", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route("**/api/search", async route => {
    calls++;
    if (calls === 1) {
      await pending;
      return route.fulfill({ status: 502, json: { detail: "Search unavailable." } });
    }
    return route.fulfill({ json: report({ rankedCreators: [creator] }) });
  });
  await login(page);
  await expect(page.getByRole("heading", { name: "Reading videos for Birkenstock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Searching…", exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toContainText("Search unavailable.");
  await page.getByRole("button", { name: "Run again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
});

test("a late search response cannot leak into another brand", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/search", async route => {
    const brand = route.request().postDataJSON().brand;
    if (brand === "Birkenstock") await pending;
    await route.fulfill({ json: report({ brand, rankedCreators: brand === "Birkenstock" ? [creator] : [] }) });
  });
  await login(page);
  await expect(page.getByRole("heading", { name: "Reading videos for Birkenstock" })).toBeVisible();
  await page.getByRole("button", { name: "Change brand", exact: true }).click();
  await page.getByLabel("Brand name", { exact: true }).fill("Ryanair");
  await page.getByRole("button", { name: "Open workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No creators ranked in this sample" })).toBeVisible();
  release();
  await page.getByRole("link", { name: "Creators", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No saved creators yet" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "No saved creators yet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "@alice" })).toHaveCount(0);
});

test("storage failures are visible while work remains usable in the tab", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("unpaid.workspace.")) throw new DOMException("Full", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.route("**/api/search", route => route.fulfill({ json: report({ rankedCreators: [creator] }) }));
  await login(page);
  await page.getByRole("button", { name: "Save creator: @alice", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  await page.getByRole("link", { name: "Creators", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
  for (const brand of ["Ryanair", "Birkenstock"]) {
    await page.getByRole("button", { name: "Change brand", exact: true }).click();
    await page.getByLabel("Brand name", { exact: true }).fill(brand);
    await page.getByRole("button", { name: "Open workspace", exact: true }).click();
  }
  await page.getByRole("link", { name: "Creators", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
});

test("saving twice does not duplicate a creator and removal persists", async ({ page }) => {
  await page.route("**/api/search", route => route.fulfill({ json: report({ rankedCreators: [creator] }) }));
  await login(page);
  await page.getByRole("button", { name: "Save creator: @alice", exact: true }).click();
  await page.getByRole("button", { name: "Saved creator: @alice", exact: true }).click();
  await page.getByRole("link", { name: "Creators", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@alice" })).toHaveCount(1);
  await page.getByRole("button", { name: "Remove saved creator: @alice", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No saved creators yet" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "No saved creators yet" })).toBeVisible();
});

test("existing contacted creators are carried into the saved workspace", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unpaid.pipeline.brands.Birkenstock", JSON.stringify({ "instagram:alice": 2 })));
  await page.route("**/api/search", route => route.fulfill({ json: report({ rankedCreators: [creator] }) }));
  await login(page);
  await expect(page.getByRole("button", { name: "Run again", exact: true })).toBeEnabled();
  await page.getByRole("link", { name: "Outreach", exact: true }).click();
  await page.getByRole("tab", { name: "1 Replied", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
});

test("mobile overview fits the screen and all workspace tabs remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/search", route => route.fulfill({ json: report({ rankedCreators: [creator] }) }));
  await login(page);
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/brand-workspace-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Save creator: @alice", exact: true }).click();
  await page.getByRole("link", { name: "Creators", exact: true }).click();
  await page.getByRole("button", { name: "Draft message: @alice" }).click();
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeVisible();
  expect(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "Outreach", exact: true }).click();
  await expect(page.getByRole("tab", { name: "1 To contact", exact: true })).toBeVisible();
});

test("changing brands still works when the browser cannot persist the session", async ({ page }) => {
  await page.route("**/api/search", route => route.fulfill({ json: report({ brand: route.request().postDataJSON().brand }) }));
  await login(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "unpaid.session") throw new DOMException("Full", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Change brand", exact: true }).click();
  await page.getByLabel("Brand name", { exact: true }).fill("Ryanair");
  await page.getByRole("button", { name: "Open workspace", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("brand selection could not be saved");
  await expect(page.locator(".workspace-brand")).toHaveText("Ryanair");
  await expect(page.getByRole("heading", { name: "No creators ranked in this sample" })).toBeVisible();
});

test("failed searches can retry and retain the previous report", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/search", route => {
    calls++;
    return calls === 2 ? route.fulfill({ status: 502, json: { detail: "Search provider timed out." } })
      : route.fulfill({ json: report({ rankedCreators: [creator] }) });
  });
  await login(page);
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
  await page.getByRole("button", { name: "Run again", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Search provider timed out.");
  await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
  await page.getByRole("button", { name: "Run again", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run again", exact: true })).toBeEnabled();
  expect(calls).toBe(3);
});

test("changing brands isolates saved creators and switching back restores them", async ({ page }) => {
  await page.route("**/api/search", route => {
    const brand = route.request().postDataJSON().brand;
    return route.fulfill({ json: report({ brand, rankedCreators: brand === "Birkenstock" ? [creator] : [] }) });
  });
  await login(page);
  await page.getByRole("button", { name: "Save creator: @alice", exact: true }).click();
  for (const brand of ["Ryanair", "Birkenstock"]) {
    await page.getByRole("button", { name: "Change brand", exact: true }).click();
    await page.getByLabel("Brand name", { exact: true }).fill(brand);
    await page.getByRole("button", { name: "Open workspace", exact: true }).click();
    await page.getByRole("link", { name: "Creators", exact: true }).click();
    if (brand === "Ryanair") await expect(page.getByRole("heading", { name: "No saved creators yet" })).toBeVisible();
    else await expect(page.getByRole("heading", { name: "@alice" })).toBeVisible();
  }
});
