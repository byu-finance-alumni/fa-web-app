# fa-web-app

Frontend web application for the **BYU Finance Alumni Database** — an internal CRM for the BYU
Finance program. Built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase Auth.

See `CLAUDE.md` for architecture/context and `UX-UI.md` for the design system. The running
checklist of work lives in `NEXT-STEPS.md`.

**Live:** https://finance.alumni.byu.edu (deployed on Vercel as `finance-alumni-database`)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (Next.js config) |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |

## CI Checks

Every **pull request into** and **push to** `dev` and `prod` runs checks across
GitHub Actions (`ci.yml`, `ferpa-audit.yml`, `board-in-review.yml`) plus Vercel's
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
| **Lint, Typecheck & Build** | `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build` | One job covering style, TypeScript types, and the **same Next.js production build Vercel runs** — so a green build means the deploy won't fail on a compile/type error. `npm ci` also fails if `package-lock.json` is out of sync. |
| **Secret scan (gitleaks)** | `gitleaks detect` over **full** git history | Blocks committed secrets (keys, tokens) anywhere in history. Only `NEXT_PUBLIC_*` (browser-safe) values belong in the client. |
| **Repo hygiene (no scratch artifacts)** | fails if any tracked file matches scratch patterns (`TEST_*`, `SCRATCH*`, `DRAFT_*`, `*.scratch`, `.board-seed*`, `*DO_NOT_MERGE*`) | `dev` is the AI/testing sandbox that promotes to prod — throwaway files must never ride along. Lowercase `tests/` is unaffected. |
| **FERPA static check** | `python scripts/ferpa_check.py` (deterministic, no API key) | Enforces FERPA/privacy controls statically: **no client-side record export** (a full-profile export must go through the audited server endpoint), and no secret-looking non-`NEXT_PUBLIC_` env vars in client code. See `scripts/FERPA_CHECKS.md`. |

### Prod-only tier — runs only when promoting to `prod` (required on `prod`)

| Check | What it runs | Why it exists |
|-------|--------------|---------------|
| **Dependency audit (prod only)** | `npm audit --omit=dev --audit-level=high` | Blocks high/critical runtime advisories before a release (low-severity noise won't block). Skipped on `dev` — and therefore **not** required on `dev`. |

### Automation (not a pass/fail gate)

| Job | When | What it does |
|-----|------|--------------|
| **Move linked issues to In Review** | when a PR is opened / marked ready | Moves the PR's linked board issues into **In Review** on org Project #4. Needs the `PROJECTS_TOKEN` secret; a graceful no-op without it (never fails a PR). |

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
workflow forwards any `NEXT_PUBLIC_*` repo Secrets to the build step). There are
no unit tests yet, so no separate test job runs.

### Required status checks (summary)

| Branch | Required to merge |
|--------|-------------------|
| **`dev`** | Lint, Typecheck & Build · Secret scan · Repo hygiene · FERPA static check · Vercel – dev-fa-web-app |
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

```bash
git fetch origin
git push origin origin/prod:dev   # fast-forward dev up to prod (works while dev has no unmerged work)
```

If branch protection blocks the direct push, open a quick `prod → dev` PR instead. Do this at the end
of each working day so `dev` never drifts.

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
| `dev` (`dev-fa-web-app`)    | the original project       | mock data           |
| `prod` (`finance-alumni-database`) | a new, dedicated project | clean; real data later |

> ⏳ The dedicated prod project is provisioned during the database split. Until
> then prod still uses the original project's keys.
