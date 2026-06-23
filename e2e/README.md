# End-to-end tests (Playwright)

These specs run against a **deployed** site (the dev Vercel app by default), not
a locally-built server — `playwright.config.ts` deliberately has **no
`webServer`**. Point them elsewhere with `E2E_BASE_URL`.

## What they cover

- **`auth-navigation.spec.ts`** — smoke specs that run **without credentials**:
  - a protected route (`/alumni`) redirects to `/login` when signed out (proves
    the middleware auth guard),
  - `/login` renders the sign-in form (email + password inputs + a "Sign in"
    control),
  - the public landing `/` responds without erroring (lenient — it may redirect),
  - browser **Back** on public routes stays sane (no error, login form intact).
- **`backbutton-logout.spec.ts`** — the authenticated repro for **issue #31**
  (back-button-logout). It logs in, navigates a few pages, then presses Back
  several times and asserts the user is never bounced to `/login`. It
  **self-skips** unless `E2E_USER` / `E2E_PASS` are provided.

## Prerequisite

Install the browser once:

```bash
npx playwright install chromium
```

## Run the smoke specs (no credentials)

```bash
npm run e2e
# or target a different deploy:
E2E_BASE_URL=https://your-preview.vercel.app npm run e2e
```

## Run the authenticated #31 repro

```bash
E2E_USER=you@byu.edu E2E_PASS=your-password npm run e2e
```

### Fully reproducing the idle-expiry condition

The original bug only fired after the Supabase **JWT expired while the tab sat
idle**, then Back was clicked. JWTs default to ~1 hour, which is impractical to
wait out in a test. To force it, temporarily shorten the **JWT expiry** in the
**dev** Supabase project's Auth settings (Authentication → Sessions / JWT
expiry), then run the authenticated spec — it performs the navigate-then-Back
sequence that triggered the bug. This spec is the automation around that manual
settings step; revert the expiry afterward.

> Note: e2e is intentionally **not** wired into the required CI build
> (`ci.yml`) — browser downloads + live-site dependence would make it flaky.
> It runs on demand via `npm run e2e`.
