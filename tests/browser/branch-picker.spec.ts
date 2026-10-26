import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

const rows = (page: Page) => page.locator(".bp-pick");

// Counts Web Animations started by the page. Picking is a client-side navigation,
// so the count survives onto the menu.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as Window & { __animated?: number };
    w.__animated = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      w.__animated! += 1;
      return animate.apply(this, args);
    };
  });
});
const animated = (page: Page) => page.evaluate(() => (window as Window & { __animated?: number }).__animated);

test("the picker shows four branches with hours and status, without scrolling", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Choose your branch" })).toBeVisible();
  await expect(rows(page)).toHaveCount(4);
  for (const [i, name] of ["Down Town", "Al-Thumama", "West Bay", "Al-Khor"].entries()) {
    const row = rows(page).nth(i);
    await expect(row.locator(".bp-name")).toHaveText(name);
    await expect(row.locator(".bp-hours")).toHaveText(/\d(am|pm)\u2009\u2013\u2009\d/);
    await expect(row.locator(".bp-status")).toHaveText(/Open now|Closes in \d+ min|Opens /);
    await expect(row).toHaveAttribute("aria-label", new RegExp(`^${name}, `));
    await expect(row).toBeInViewport({ ratio: 1 });
  }
  const scroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(scroll).toBeLessThanOrEqual(0);
});

test("tapping a piece opens that branch's menu and remembers it", async ({ page, context }) => {
  await page.goto("/");
  await rows(page).first().click();
  await page.waitForURL("**/down-town");
  expect(await animated(page)).toBe(4); // chopsticks, two sticks, the piece
  await expect(page.locator("#main.feed, #main[role=feed]")).toBeVisible();
  await expect(page.locator(".slide").first()).toBeVisible();
  const mark = page.getByRole("link", { name: /Down Town, change branch/ });
  await expect(mark.locator(".branch-switch")).toContainText("Down Town");
  const cookie = (await context.cookies()).find((c) => c.name === "sushina-branch");
  expect(cookie?.value).toBe("down-town");
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(360 * 24 * 3600 * 1000);

  // The switch always shows the picker, even with a remembered branch.
  await mark.click();
  await page.waitForURL("**/?pick=1");
  await expect(rows(page)).toHaveCount(4);
});

test("a remembered branch skips the picker with a server redirect", async ({ page, context, baseURL, request }) => {
  await context.addCookies([{ name: "sushina-branch", value: "west-bay", url: baseURL! }]);
  const res = await request.get("/", { maxRedirects: 0, headers: { cookie: "sushina-branch=west-bay" } });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toMatch(/\/west-bay$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/west-bay$/);
  await expect(page.locator(".branch-switch")).toContainText("West Bay");
  await page.goto("/?pick=1");
  await expect(rows(page)).toHaveCount(4);
});

test("an unknown remembered branch is ignored", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "sushina-branch", value: "../admin", url: baseURL! }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(rows(page)).toHaveCount(4);
});

test("reduced motion skips the chopsticks and navigates straight away", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".bp-sheen").first()).toHaveCSS("animation-name", "none");
  await rows(page).nth(3).click();
  await page.waitForURL("**/al-khor", { timeout: 3000 });
  expect(await animated(page)).toBe(0);
});

test("each row is a real link that works from the keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(rows(page).nth(2)).toHaveAttribute("href", "/west-bay");
  await rows(page).nth(2).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/west-bay");
});

test("an unknown branch is a real 404 and other pages still work", async ({ page, request }) => {
  expect((await request.get("/no-such-branch")).status()).toBe(404);
  const contact = await page.goto("/contact");
  expect(contact?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();
});
