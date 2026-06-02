# fa-web-app

Frontend web application for the **BYU Finance Alumni Database** — an internal CRM for the BYU
Finance program. Built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase Auth.

See `CLAUDE.md` for architecture/context and `UX-UI.md` for the design system. The running
checklist of work lives in `NEXT-STEPS.md`.

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

Every **pull request** and every **push to `main` or `dev`** runs the GitHub Actions workflow in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). The job **Lint, Typecheck & Build** runs:

1. **Install** — `npm ci` (clean install against the committed lockfile)
2. **Lint** — `npm run lint`
3. **Typecheck** — `npm run typecheck`
4. **Build** — `npm run build` (Next.js production build)

If lint, typecheck, or the build fails, the check fails and the PR is marked accordingly. There are
no tests yet, so no test step runs.

The build needs **no secrets** — public env vars default to empty strings during CI. (If build-time
required env vars are added later, set them as repository **Secrets** and the workflow forwards them
to the build step.)

**Where to see results:** open a pull request and look at the **Checks** section at the bottom, or
go to the repo's **Actions** tab on GitHub to see each run, its logs, and pass/fail status.
