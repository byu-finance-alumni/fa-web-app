import { test, expect } from "@playwright/test";

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
