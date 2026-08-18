import { test, expect, type Page } from "@playwright/test";

// Smoke specs — run WITHOUT credentials against E2E_BASE_URL (default: the dev
// Vercel deploy). They prove the middleware auth guard and Back-button handling
// behave on public/unauthenticated routes. The authenticated #31 repro lives in
// backbutton-logout.spec.ts and self-skips without creds.

test.describe("auth navigation (unauthenticated)", () => {
  test("protected route redirects to /login", async ({ page }) => {
    // Visiting a protected app route while signed out must bounce to /login —
    // this is the middleware guard (updateSession) doing its job.
    await page.goto("/alumni");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the bounce remembers where the user was headed (#682)", async ({
    page,
  }) => {
    // Return-to-page is the behaviour #682 settled on KEEPING, so the middleware
    // must hand the intended path to /login as `?next=`. Without this the user
    // silently loses their place on every session expiry.
    await page.goto("/alumni/42");
    await expect(page).toHaveURL(/\/login/);
    const next = new URL(page.url()).searchParams.get("next");
    expect(next, "the login bounce should carry ?next=").toBe("/alumni/42");
  });

  test("a crafted ?next= never moves the browser off-origin (#682)", async ({
    page,
  }) => {
    // The destination is attacker-influenceable — `?next=` rides on a URL anyone
    // can hand a victim — so this is the security assertion, not a UX one.
    //
    // `/\evil.com` is the case that defeated the old string-prefix check: per
    // the WHATWG URL spec a browser reads `\` as `/` in the authority position,
    // so it cleared `startsWith("/") && !startsWith("//")` and still resolved to
    // https://evil.com/. Unauthenticated we can only assert the login page
    // itself never leaves the origin; the post-sign-in half is asserted in the
    // credentialed block below.
    for (const next of [
      "/\\evil.com",
      "//evil.com",
      "https://evil.com",
      "/\t/evil.com",
    ]) {
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      expect(
        new URL(page.url()).hostname,
        `?next=${JSON.stringify(next)} must not navigate off-origin`,
      ).not.toContain("evil.com");
    }
  });

  test("/login renders the sign-in form", async ({ page }) => {
    await page.goto("/login");

    // Email + password inputs exist (LoginForm uses id="email" type="email" and
    // id="password"). Fall back to type selectors so the assertion is robust to
    // small markup changes.
    const email = page
      .locator(
        'input#email, input[type="email"], input[name="email"], input[autocomplete="email"]',
      )
      .first();
    const password = page
      .locator(
        'input#password, input[type="password"], input[name="password"], input[autocomplete="current-password"]',
      )
      .first();
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    // A visible "Sign in"-ish submit control.
    const signIn = page.getByRole("button", { name: /sign\s*in/i });
    await expect(signIn).toBeVisible();
  });

  test("public landing / responds without erroring", async ({ page }) => {
    // Lenient: `/` may redirect (e.g. to /login or /dashboard). We only assert
    // it resolves to a non-error response, not a specific destination.
    const response = await page.goto("/");
    expect(response, "navigation should produce a response").not.toBeNull();
    // A final 2xx/3xx (Playwright follows redirects) — anything < 400 is fine.
    expect(response!.status()).toBeLessThan(400);
  });

  test("Back navigation on public routes stays sane", async ({ page }) => {
    // Exercise browser Back handling WITHOUT auth: start at /login, navigate to
    // a public path, then go Back and confirm the page is still healthy (no
    // error, and the login form is intact). This mirrors the shape of the #31
    // repro without needing a session.
    await page.goto("/login");
    await expect(
      page
        .locator('input#email, input[type="email"], input[name="email"]')
        .first(),
    ).toBeVisible();

    // Navigate away to a public path. `/` is public (it may redirect, which is
    // fine — we just need a second history entry to go Back from).
    await page.goto("/");

    const back = await page.goBack();
    // Going Back should not error out.
    if (back) {
      expect(back.status()).toBeLessThan(400);
    }

    // After Back the URL should be a sane public route (login or root), and the
    // page should not be showing an application error. The regex anchors at the
    // end so it can't match an arbitrary path that merely contains a slash.
    await expect(page).toHaveURL(/\/(login)?$/);
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("application error");
    expect(body).not.toContain("internal server error");
  });
});

// The post-sign-in half of #682. Completing a login needs real credentials, so
// this block self-skips exactly like backbutton-logout.spec.ts:
//   E2E_USER=… E2E_PASS=… npm run e2e
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

test.describe("post-login destination (#682)", () => {
  test.skip(
    !USER || !PASS,
    "set E2E_USER/E2E_PASS to run the post-login redirect checks",
  );

  async function signInFrom(page: Page, loginUrl: string) {
    await page.goto(loginUrl);
    await page
      .locator('input#email, input[type="email"], input[name="email"]')
      .first()
      .fill(USER!);
    await page
      .locator('input#password, input[type="password"], input[name="password"]')
      .first()
      .fill(PASS!);
    await page.getByRole("button", { name: /sign\s*in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  }

  test("an honest ?next= returns the user to that page", async ({ page }) => {
    await signInFrom(page, "/login?next=%2Falumni");
    await expect(page).toHaveURL(/\/alumni/);
  });

  test("no ?next= lands on the dashboard", async ({ page }) => {
    await signInFrom(page, "/login");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  for (const hostile of [
    "/\\evil.com",
    "//evil.com",
    "https://evil.com",
    "/\t/evil.com",
    "javascript:alert(1)",
  ]) {
    test(`a crafted ?next=${JSON.stringify(hostile)} cannot move the user off-origin`, async ({
      page,
      baseURL,
    }) => {
      await signInFrom(
        page,
        `/login?next=${encodeURIComponent(hostile)}`,
      );
      // THE assertion: whatever happens, the browser is still on our origin.
      expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
      // ...and specifically on the safe fallback, not somewhere arbitrary.
      await expect(page).toHaveURL(/\/dashboard/);
    });
  }
});
