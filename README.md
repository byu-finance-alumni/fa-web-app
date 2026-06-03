# fa-web-app

Frontend web application for the **BYU Finance Alumni Database** — an internal CRM for the BYU
Finance program. Built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase Auth.

See `CLAUDE.md` for architecture/context and `UX-UI.md` for the design system. The running
checklist of work lives in `NEXT-STEPS.md`.

**Live:** https://finance-alumni-database.vercel.app (deployed on Vercel)

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

Every **pull request** and every **push to `prod` or `dev`** runs the GitHub Actions workflow in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). Checks are **two-tiered**:

**Base tier — runs for both `dev` and `prod`:**

1. **Lint, Typecheck & Build** — `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build`.
   The build is the same Next.js production build Vercel runs, so a green build means the deploy
   won't break on a compile error.
2. **Secret scan (gitleaks)** — `gitleaks detect` over full git history; blocks committed secrets.

**Prod-only tier — runs only when promoting to `prod`:**

3. **Dependency audit (prod only)** — `npm audit --omit=dev --audit-level=high`; blocks
   known-vulnerable runtime dependencies before release.

The build needs **no secrets** — public env vars default to empty strings during CI. (If build-time
required env vars are added later, set them as repository **Secrets** and the workflow forwards them
to the build step.) There are no unit tests yet, so no test step runs.

**Where to see results:** a pull request's **Checks** section, or the repo's **Actions** tab on GitHub.

Base checks are **required status checks** on `prod` and `dev` (plus the prod-only audit on `prod`),
so a PR can't merge until they pass.

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
