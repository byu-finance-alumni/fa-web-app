import { test, expect } from "@playwright/test";

// Issue #806 — paging the alumni list must return you to the top.
//
// THE BUG THIS GUARDS: clicking Next left the scroll position where it was, so
// you landed at the BOTTOM of the next page looking at its last row.
//
// WHY IT NEEDS A BROWSER: the first fix for this called `window.scrollTo` and
// shipped to prod doing absolutely nothing, because the document is not what
// scrolls in this app — every (app) page owns a `<main className="flex-1
// overflow-auto">` inside an `[overflow:clip]` shell column, so the scrollbar
// belongs to that <main>. A source-text unit test asserted the call existed and
// passed happily while the feature was broken. Only reading back a real
// scrollTop catches that class of mistake, which is why this spec exists.
//
// CREDENTIALS REQUIRED — self-skips unless E2E_USER / E2E_PASS are set:
//   E2E_USER=… E2E_PASS=… npx playwright test e2e/alumni-paging-scroll.spec.ts

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

/** scrollTop of the element that actually scrolls, whichever it is. */
async function scrollPosition(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      main: main ? main.scrollTop : null,
      window: window.scrollY,
      mainScrollable: main ? main.scrollHeight > main.clientHeight : false,
    };
  });
}

test.describe("#806 — paging the alumni list returns you to the top", () => {
  test.skip(!USER || !PASS, "set E2E_USER/E2E_PASS to run this");

  test("clicking Next scrolls back to the top of the list", async ({ page }) => {
    await page.goto("/login");
    await page
      .locator('input#email, input[type="email"], input[name="email"]')
      .first()
      .fill(USER!);
    await page
      .locator('input#password, input[type="password"], input[name="password"]')
      .first()
      .fill(PASS!);
    await page.getByRole("button", { name: /sign\s*in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|alumni)/, { timeout: 30_000 });

    await page.goto("/alumni");
    await expect(page).toHaveURL(/\/alumni/);

    const next = page.getByRole("link", { name: /Next/ });
    await expect(next).toBeVisible({ timeout: 30_000 });

    // Establish that <main> is genuinely the scroller. If this ever flips to the
    // document, the assertion below still holds but the premise has changed.
    await page.evaluate(() => {
      document.querySelector("main")?.scrollTo({ top: 100_000 });
      window.scrollTo({ top: 100_000 });
    });
    const before = await scrollPosition(page);
    expect(before.mainScrollable).toBe(true);
    expect(before.main ?? 0).toBeGreaterThan(0);

    await next.click();
    await page.waitForURL(/offset=/, { timeout: 30_000 });

    // Poll rather than sleeping a fixed interval: the scroll lands in an effect
    // after the navigation renders, and a fixed wait races it. An earlier
    // version of this spec used waitForTimeout and flaked for exactly that
    // reason -- it reported a stale scrollTop, not a real regression.
    await expect
      .poll(async () => (await scrollPosition(page)).main ?? 0, {
        timeout: 15_000,
      })
      .toBeLessThanOrEqual(5);
    expect((await scrollPosition(page)).window).toBeLessThanOrEqual(5);

    // Prev is the same component and the same offset prop, so it works by
    // construction -- but it is half of what was actually reported, so it is
    // half of what gets asserted.
    await page.evaluate(() => {
      document.querySelector("main")?.scrollTo({ top: 100_000 });
      window.scrollTo({ top: 100_000 });
    });
    expect((await scrollPosition(page)).main ?? 0).toBeGreaterThan(0);

    const prev = page.getByRole("link", { name: /Prev/ });
    await expect(prev).toBeVisible({ timeout: 30_000 });
    await prev.click();
    // Paging back to the first page DROPS the param rather than setting
    // offset=0, so wait for it to disappear -- not for it to change.
    await page.waitForURL((url) => !url.search.includes("offset="), {
      timeout: 30_000,
    });

    await expect
      .poll(async () => (await scrollPosition(page)).main ?? 0, {
        timeout: 15_000,
      })
      .toBeLessThanOrEqual(5);
    expect((await scrollPosition(page)).window).toBeLessThanOrEqual(5);
  });
});
