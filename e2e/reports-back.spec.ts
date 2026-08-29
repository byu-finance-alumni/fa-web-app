import { test, expect, type Page } from "@playwright/test";

// Back, from a report, returns to Reports (#775 review).
//
// THE SYMPTOM REPORTED: from /reports, clicking a report opens the filtered
// alumni list; pressing Back then lands on the alumni list showing ALL alumni
// instead of returning to Reports. That can only happen if the click costs more
// than one history entry — a second, unasked-for entry sitting between /reports
// and the filtered list, so one Back only rewinds to the list.
//
// The thing that could add one is the alumni Filters panel: it re-serializes its
// state into the URL and navigates whenever that serialization differs from what
// it last wrote. It stays silent on arrival because it seeds its "last written"
// ref from the MODEL (`toQs(initial)`) rather than from the raw querystring, and
// because every report href is already the canonical serialization. The unit
// guards on both live in `src/lib/reports.test.ts`; this is the end-to-end walk.
//
// WHY IT ASSERTS THE ENTRY COUNT AND NOT JUST THE URL: a spec that only pressed
// Back once and checked the URL would still pass with a stray entry present if
// the stray one happened to be /reports as well. Counting entries is what
// actually pins "one click, one entry".
//
// CREDENTIALS REQUIRED: /reports is behind auth and the `reports.advanced`
// capability, so this self-skips unless E2E_USER / E2E_PASS are set:
//   E2E_USER=… E2E_PASS=… npm run e2e

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

/** The report to walk. Any list-backed row would do; this one is never empty. */
const REPORT_LINK = /alumni list filtered to alumni with no photo/i;

async function signIn(page: Page) {
  await page.goto("/login");
  // Wait for hydration before typing: the sign-in form keeps a native GET
  // fallback, and submitting it unhydrated puts the password in the URL.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_000);
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
}

test.describe("#775 — Back from a report returns to Reports", () => {
  test.skip(
    !USER || !PASS,
    "set E2E_USER/E2E_PASS to run the authenticated Reports back-button walk",
  );

  test("a report click costs exactly one history entry", async ({ page }) => {
    await signIn(page);

    // Arrive at Reports the way staff do — from the alumni list, so the entry
    // BEFORE /reports is the unfiltered roster. That ordering is what makes the
    // failure legible: a stray entry means one Back lands on all alumni.
    await page.goto("/alumni");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2_000);

    await page.goto("/reports");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2_000);
    await expect(page).toHaveURL(/\/reports$/);
    const before = await page.evaluate(() => history.length);

    await page.getByRole("link", { name: REPORT_LINK }).click();
    await expect(page).toHaveURL(/\/alumni\?missing_photo=1$/, {
      timeout: 20_000,
    });

    // Settle well past the panel's 300ms filter debounce: a mount-time rewrite
    // would land in this window, and the URL must still be the one clicked.
    await page.waitForTimeout(3_000);
    await expect(page).toHaveURL(/\/alumni\?missing_photo=1$/);
    expect(
      await page.evaluate(() => history.length),
      "clicking a report must add exactly one history entry",
    ).toBe(before + 1);

    // One Back, and Reports is on screen — not the alumni list.
    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/reports$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /^Missing data$/ }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("live filtering does not stack an entry per keystroke", async ({
    page,
  }) => {
    // The other half of the same guarantee: `replace`, not `push`, on the
    // filter sync. If this regresses, Back from a filtered list steps back
    // through filter states instead of leaving the page.
    await signIn(page);
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2_000);
    await page.getByRole("link", { name: REPORT_LINK }).click();
    await expect(page).toHaveURL(/missing_photo=1/, { timeout: 20_000 });
    await page.waitForTimeout(3_000);
    const before = await page.evaluate(() => history.length);

    const search = page
      .locator('input[type="search"], input[placeholder*="earch"]')
      .first();
    await search.fill("smith");
    await expect(page).toHaveURL(/q=smith/, { timeout: 20_000 });
    await page.waitForTimeout(2_000);
    expect(
      await page.evaluate(() => history.length),
      "typing in the search box must replace the entry, not push new ones",
    ).toBe(before);

    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/reports$/, { timeout: 20_000 });
  });
});
