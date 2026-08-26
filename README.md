# fa-web-app

Frontend web application for the **BYU Finance Alumni Database** — an internal CRM for the BYU
Finance program. Built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase Auth.

See `CLAUDE.md` for architecture/context and `UX-UI.md` for the design system.

⚠️ Work is tracked on the **GitHub Project board**
(<https://github.com/orgs/byu-finance-alumni/projects/4>), not in this repo.
`NEXT-STEPS.md` is a historical checklist and stopped being updated before launch.

**Live:** https://finance.alumni.byu.edu (deployed on Vercel as `finance-alumni-database`)

## Local development

```bash
npm install
cp .env.example .env         # fill in values (Next also reads .env.local, which wins)
npm run dev                  # http://localhost:3000
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server, using `NEXT_PUBLIC_API_URL` from `.env` as-is |
| `npm run dev:local` | Dev server against a **locally running** `fa-web-api` (`localhost:8000`) |
| `npm run dev:remote` | Dev server against the **dev** deploy of the API |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm run test` | **Vitest unit tests** — ⚠️ typecheck alone is not enough; run this before pushing |
| `npm run e2e` | Playwright end-to-end suite (not part of PR checks — see below) |
| `npm run gen:api-types` | Regenerate `src/types/api.gen.ts` from the backend's OpenAPI schema |

> ⚠️ **`gen:api-types` resolves its source URL from `NEXT_PUBLIC_API_URL`**, which
> may point at **prod** — and prod's `/openapi.json` is **404 by design**. Pin it
> explicitly to the environment you mean:
> `API_SCHEMA_URL=https://dev-fa-web-api.vercel.app/openapi.json npm run gen:api-types`

## CI Checks

Every **pull request into** and **push to** `dev` and `prod` runs checks across
GitHub Actions (`ci.yml`, `e2e.yml`, `ferpa-audit.yml`, `security-audit.yml`) plus Vercel's
own deployment check. This documents **every check**: what it does, why, when it
runs, and whether it's **required** (a required check that isn't green blocks the
merge; required checks are set in the repo's branch **rulesets**, not these files).

Two principles:
- **`dev` promotes to `prod`** (which holds **real alumni data**), so every gate
  that protects prod also runs on dev — problems must be caught before a promotion.
- **Tiered:** a *base* tier runs on both branches; a *prod-only* tier adds release
  hardening. A prod-only check is **skipped on `dev`**, so it must **never** be
  required on `dev` (a skipped required check blocks merges forever).

### Base tier — runs on `dev` **and** `prod` (required on both)

| Check | What it runs | Why it exists |
|-------|--------------|---------------|
| **Lint, Typecheck & Build** | `npm ci` → `lint` → `typecheck` → **`test` (vitest)** → `build` | One job covering style, types, **unit tests**, and the **same Next.js production build Vercel runs** — so green means the deploy won't fail on a compile/type error. `npm ci` also fails if `package-lock.json` is out of sync. |
| **API types in sync with backend** | regenerates `src/types/api.gen.ts` from the backend's served OpenAPI schema and fails on any diff | `api.gen.ts` is generated, never hand-edited. This is the contract guard: a backend field rename or removal surfaces as a failing check here instead of a runtime crash in the browser. ⚠️ If it fails, the fix is to land the backend change on dev, regenerate, and commit — not to edit the file. |
| **Secret scan (gitleaks)** | `gitleaks detect` over **full** git history | Blocks committed secrets (keys, tokens) anywhere in history. Only `NEXT_PUBLIC_*` (browser-safe) values belong in the client. |
| **Repo hygiene (no scratch artifacts)** | fails if any tracked file matches scratch patterns (`TEST_*`, `SCRATCH*`, `DRAFT_*`, `*.scratch`, `.board-seed*`, `*DO_NOT_MERGE*`) | `dev` is the AI/testing sandbox that promotes to prod — throwaway files must never ride along. Lowercase `tests/` is unaffected. |
| **FERPA static check** | `python scripts/ferpa_check.py` (deterministic, no API key) | Enforces FERPA/privacy controls statically: **no client-side record export** (a full-profile export must go through the audited server endpoint), and no secret-looking non-`NEXT_PUBLIC_` env vars in client code. See `scripts/FERPA_CHECKS.md`. |

### Prod-only tier — runs only when promoting to `prod` (required on `prod`)

| Check | What it runs | Why it exists |
|-------|--------------|---------------|
| **Dependency audit (prod only)** | `npm audit --omit=dev --audit-level=high` | Blocks high/critical runtime advisories before a release (low-severity noise won't block). Skipped on `dev` — and therefore **not** required on `dev`. |

### Automation

> ⚠️ **Board cards are moved BY HAND.** The `board-in-review.yml` workflow that
> used to do it was **deleted from both repos on 2026-07-03**: it regex-matched
> bare `#NNN` in PR text, so a number meaning an issue in *this* repo moved the
> same-numbered issue in the *other* one, and it 404'd on cross-repo refs. When
> writing PR bodies, avoid bare `#NNN` for cross-repo references — write
> "fa-web-api PR 498".

### External — Vercel deployment check (required)

| Check | Branch | What it does |
|-------|--------|--------------|
| **Vercel – dev-fa-web-app** | `dev` | Vercel builds + deploys the branch to the **dev** app project. Green = the deploy didn't break. Required on `dev`. |
| **Vercel – finance-alumni-database** | `prod` | Same for the **prod** app project. Required on `prod`. |

> ⚠️ The Vercel check names contain a real **en-dash `–` (U+2013)**. When editing
> the rulesets' required checks, preserve that exact character — a mangled name
> (e.g. via a Windows cp1252 round-trip) becomes a required check that can never
> report, silently **blocking all merges**.

The build needs **no secrets** — public env vars default to empty during CI (the
workflow forwards any `NEXT_PUBLIC_*` repo Secrets to the build step).

**Tests:** there are **~1,500 Vitest unit tests**, run inside the *Lint, Typecheck
& Build* job rather than as a separate check — so a green build already means the
suite passed. The **Playwright e2e suite is NOT a PR gate**: `e2e.yml` is
`workflow_dispatch` only (Actions → e2e → Run workflow), taking a target base URL
that defaults to the dev deploy.

### Required status checks (summary)

| Branch | Required to merge |
|--------|-------------------|
| **`dev`** | Lint, Typecheck & Build · API types in sync with backend · Secret scan · Repo hygiene · FERPA static check · Vercel – dev-fa-web-app |
| **`prod`** | the above **+** Dependency audit (prod only) · Vercel – finance-alumni-database |

**Where to see results:** a PR's **Checks** section, or the repo's **Actions** tab.

## Branching & deploy

| Branch | Role | Vercel project |
| --- | --- | --- |
| `prod` | Default / production | `finance-alumni-database` (builds `prod` only) |
| `dev`  | Integration branch for active work | `dev-fa-web-app` (builds `dev` + PR previews) |

Flow: branch off `dev` → PR into `dev` (base checks + `dev-fa-web-app` preview) → merge →
PR `dev` → `prod` (adds the prod-only audit) → merge → `finance-alumni-database` deploys production.
Both branches reject direct pushes.

**Back-merge `prod → dev` after every release (end-of-day routine).** A `dev → prod` merge creates a
merge commit that lives only on `prod`, so `dev` immediately reads as "N commits behind prod" even
though the code is identical — one commit per release. Sync it back so the count resets to 0:

⚠️ **Direct pushes to `dev` are blocked by the ruleset** — `git push origin origin/prod:dev` is
rejected ("repository rule violations"). Open a PR instead; the content is identical, so its checks
pass quickly:

```bash
git fetch origin
gh pr create --base dev --head prod --title "chore: back-merge prod into dev"
```

That leaves `dev` 1 ahead (the back-merge commit) and `prod` 0 ahead — the correct synced state.
Verify with `git rev-list --count origin/dev..origin/prod` (expect `0`) and confirm
`git diff origin/dev origin/prod` is empty.

Do this **immediately after every promotion**, not only at end of day.

Vercel is split into **two projects (one per branch)**, both linked to this repo. Each uses an
*Ignored Build Step* (Settings → Git) so it only builds its own branch:

- `dev-fa-web-app` → `[ "$VERCEL_GIT_COMMIT_REF" = "prod" ]` (build everything except `prod`)
- `finance-alumni-database` → `[ "$VERCEL_GIT_COMMIT_REF" != "prod" ]` (build `prod` only)

### Supabase projects — one per environment

`dev` and `prod` now use **separate Supabase projects** — the backend's dev and
prod databases (and their Auth users) are no longer shared. Each environment's
Vercel project carries that project's `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`:

| Environment (Vercel)        | Supabase project           | Data                |
|-----------------------------|----------------------------|---------------------|
| `dev` (`dev-fa-web-app`)    | the original project       | mock data — the sandbox |
| `prod` (`finance-alumni-database`) | a dedicated project | **real alumni data** |

> ✅ **The split completed 2026-07-09** — prod has its own project and its own keys.
>
> ⚠️ **A local `.env` here points `NEXT_PUBLIC_API_URL` at PROD.** `.env` is
> gitignored, so this is a per-machine setting, not something you can read off the
> repo — which is exactly why it surprises people. Before trusting any API base
> URL, `curl <url>/health` and read the `environment` field.
>
> ⚠️ prod is real alumni data. Never aim destructive local work at it.
