import { test, expect, type Page } from "@playwright/test";

// The dashboard must scroll on a SHORT desktop window.
//
// THE BUG THIS GUARDS: from `lg` up the dashboard was built to fill the window
// and never scroll — `overflow: clip` on <main> and `min-h-0` down every level
// of the column. On a laptop-height window (or a zoomed browser) the bottom row
// was squeezed below its content, so the Industry breakdown and the search
// card's Search/Reset buttons were sheared off at the window edge with no
// scrollbar and a dead mouse wheel (reported on prod at 1920 wide).
//
// WHY IT NEEDS A BROWSER: whether something is clipped depends on real layout
// — flex/grid min-size resolution — which no source-text test can see. This
// reads back real geometry and drives the real mouse wheel.
//
// CREDENTIALS REQUIRED — self-skips unless E2E_USER / E2E_PASS are set:
//   E2E_USER=… E2E_PASS=… npx playwright test e2e/dashboard-scroll.spec.ts

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

async function signIn(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
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

/** Geometry of the parts that used to be cut off. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const de = document.documentElement;
    const rows = [...main.querySelectorAll("ul li")];
    const last = rows.at(-1)?.getBoundingClientRect();
    const quickSearch = [...main.querySelectorAll("button")]
      .filter((b) => b.textContent?.trim() === "Search")
      .at(-1)
      ?.getBoundingClientRect();
    return {
      mainScrollable: main.scrollHeight > main.clientHeight,
      mainScrollTop: main.scrollTop,
      docScrollable: de.scrollHeight > de.clientHeight,
      viewport: window.innerHeight,
      lastRowBottom: last ? last.bottom : null,
      quickSearchBottom: quickSearch ? quickSearch.bottom : null,
    };
  });
}

test.describe("dashboard scrolls on a short window instead of clipping", () => {
  test.skip(!USER || !PASS, "set E2E_USER/E2E_PASS to run this");

  // ONE test, ONE sign-in: single-active-session means every login ends the
  // account's other session, so three tests would kick whoever else is on it
  // three times.
  test("scrolls when short, fits when tall, and Advanced never stretches it", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signIn(page);

    for (const size of [
      { width: 1920, height: 700 },
      { width: 1366, height: 768 },
      { width: 1280, height: 720 },
      { width: 1024, height: 700 },
    ]) {
      await test.step(`short window ${size.width}x${size.height}`, async () => {
        await page.setViewportSize(size);
        await page.goto("/dashboard");
        await expect(page.getByText("Industry breakdown")).toBeVisible();

        const before = await measure(page);
        expect(before.mainScrollable).toBe(true);
        // Only ONE scrollbar: the document itself must never scroll.
        expect(before.docScrollable).toBe(false);

        // A real wheel over the page, not a scrollTo — the report was that
        // the wheel did nothing.
        await page.mouse.move(size.width / 2, size.height - 60);
        await page.mouse.wheel(0, 5_000);
        await expect
          .poll(async () => (await measure(page)).mainScrollTop, {
            timeout: 5_000,
          })
          .toBeGreaterThan(0);

        const after = await measure(page);
        expect(after.docScrollable).toBe(false);
        // The last industry row and the Quick search button are on screen.
        expect(after.lastRowBottom).not.toBeNull();
        expect(after.lastRowBottom!).toBeLessThanOrEqual(after.viewport);
        expect(after.quickSearchBottom).not.toBeNull();
        expect(after.quickSearchBottom!).toBeLessThanOrEqual(after.viewport);
      });
    }

    await test.step("a tall window shows everything with no scrolling", async () => {
      await page.setViewportSize({ width: 2560, height: 1440 });
      await page.goto("/dashboard");
      await expect(page.getByText("Industry breakdown")).toBeVisible();

      const m = await measure(page);
      expect(m.docScrollable).toBe(false);
      expect(m.mainScrollable).toBe(false);
      expect(m.lastRowBottom!).toBeLessThanOrEqual(m.viewport);
      expect(m.quickSearchBottom!).toBeLessThanOrEqual(m.viewport);
    });

    await test.step("switching to Advanced search does not stretch the page", async () => {
      // The Advanced tab holds ~900px of facets in its own inner scroller. If
      // that height ever leaked into the row's minimum, the page would jump
      // on every tab switch.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto("/dashboard");
      await expect(page.getByText("Industry breakdown")).toBeVisible();

      const scrollHeight = () =>
        page.evaluate(() => document.querySelector("main")!.scrollHeight);
      const quick = await scrollHeight();
      await page.getByRole("tab", { name: "Advanced search" }).click();
      await expect(page.getByRole("tab", { name: "Advanced search" })).toHaveAttribute(
        "data-state",
        "active",
      );
      await expect.poll(scrollHeight).toBeLessThanOrEqual(quick);
    });
  });
});
