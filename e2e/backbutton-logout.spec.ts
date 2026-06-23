import { test, expect } from "@playwright/test";

// Authenticated repro for issue #31 ("back-button-logout").
//
// THE ORIGINAL BUG: after a Supabase JWT expired while the tab sat idle, clicking
// the browser Back button bounced an authenticated user to /login. Root cause was
// twofold — (1) the (app) layout + server api client refreshed the token with
// getUser() inside an RSC that cannot persist the rotated cookie, and (2) the
// middleware ran the Supabase refresh/redirect on PREFETCH requests, caching a
// /login redirect that a later Back nav landed on. Both are fixed; this spec is
// the automated end-to-end harness guarding that fix.
//
// CREDENTIALS REQUIRED: a full authenticated repro needs a real login, which CI
// does not have. So this whole spec self-skips unless E2E_USER / E2E_PASS are set.
// Run it locally against the dev deploy with:
//   E2E_USER=… E2E_PASS=… npm run e2e
//
// FULLY REPRODUCING THE IDLE-EXPIRY CONDITION: the original failure needed the
// session to sit idle PAST the JWT expiry before the Back click. JWTs default to
// ~1 hour, which is impractical for an automated test. To force the condition,
// temporarily shorten the Supabase JWT expiry in the DEV project's Auth settings
// (Authentication → Sessions / JWT expiry) to a small value, then run this spec —
// it performs the navigate-then-Back sequence that triggered the bug. This test
// is the automation around that manual settings step.

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

test.describe("issue #31 — Back button does not log out an authenticated user", () => {
  test.skip(
    !USER || !PASS,
    "set E2E_USER/E2E_PASS to run the authenticated back-button repro",
  );

  test("navigating across pages and pressing Back never lands on /login", async ({
    page,
  }) => {
    // 1) Sign in via /login.
    await page.goto("/login");

    const email = page
      .locator('input#email, input[type="email"], input[name="email"]')
      .first();
    const password = page
      .locator(
        'input#password, input[type="password"], input[name="password"]',
      )
      .first();
    await email.fill(USER!);
    await password.fill(PASS!);

    await page.getByRole("button", { name: /sign\s*in/i }).click();

    // 2) Confirm we reach an authenticated page (the sign-in Server Action
    //    redirects to /dashboard by default; accept /alumni too). Capture this
    //    first post-login URL as the history "floor": pressing Back must never
    //    go PAST it (the entry before it is the pre-auth /login page, which is a
    //    legitimate history entry, NOT the #31 bug).
    await expect(page).toHaveURL(/\/(dashboard|alumni)/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/login/);

    // 3) Navigate across a few authenticated pages, building real history.
    const route = (path: string) =>
      page.waitForURL(new RegExp(path.replace("/", "\\/")), {
        timeout: 20_000,
      });

    const forward = ["/alumni", "/dashboard", "/alumni"];
    for (const path of forward) {
      await page.goto(path);
      await route(path);
      await expect(page).not.toHaveURL(/\/login/);
    }

    // 4) Press Back exactly as many times as we navigated forward, so we walk
    //    back to the post-login floor but never past it into the pre-auth login
    //    entry. At no point should the user be ejected to /login, and they must
    //    remain on an authenticated route — that bounce was the #31 symptom.
    for (let i = 0; i < forward.length; i++) {
      await page.goBack();
      await page.waitForLoadState("domcontentloaded");
      await expect(
        page,
        `Back press #${i + 1} should not redirect to /login`,
      ).not.toHaveURL(/\/login/);
      await expect(
        page,
        `Back press #${i + 1} should stay on an authenticated route`,
      ).toHaveURL(/\/(dashboard|alumni)/);
    }
  });
});
