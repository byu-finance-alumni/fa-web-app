# NEXT-STEPS.md — fa-web-app

> ⚠️ **HISTORICAL — not the tracker.** Work is tracked on the GitHub Project board
> (https://github.com/orgs/byu-finance-alumni/projects/4), which replaced the local checklists on
> 2026-06-15.
>
> The unchecked boxes below are **done**: the authenticated app shell shipped, then
> was redesigned, then replaced entirely by the top nav over the Marriott photo
> (2026-08-21) — so the "sidebar + top bar" item describes an architecture the app
> no longer has. `UX-UI.md` is the live design source of truth.

Running checklist of what's done and what's next for the BYU Finance Alumni Database frontend.
Update as work progresses. Scope and rules live in `CLAUDE.md` (architecture) and `UX-UI.md` (design).

---

## Done

**App scaffold**
- [x] Next.js App Router + TypeScript + Tailwind scaffold
- [x] Brand palette + Inter font wired into `tailwind.config.ts` (from `UX-UI.md`)
- [x] Placeholder home page (`/`)
- [x] Placeholder login page (`/login`) — disabled form, no auth logic yet
- [x] Temporary API connection indicator on home page (`ApiStatus`, Lucide icons)

**Supabase / env**
- [x] Typed env accessor (`src/lib/env.ts`) + `.env.example`
- [x] Supabase SSR clients (browser/server) + session-refresh middleware

**Tooling / CI / deploy**
- [x] ESLint (flat config) + `typecheck` script; `lint`/`typecheck`/`build` all green
- [x] GitHub Actions CI (`.github/workflows/ci.yml`) — two-tier: base (`Lint, Typecheck & Build`,
      `Secret scan (gitleaks)`) on `dev`/`prod`; prod-only `Dependency audit (npm audit)` on `prod`
- [x] Branch protection (rulesets): PR required on both branches; base checks required on `dev`,
      base + audit on `prod`; "require branches up to date" disabled to avoid the promotion treadmill
- [x] **Live on Vercel** → https://finance.alumni.byu.edu (prod custom domain) — **two projects, one per branch**
      (`dev-fa-web-app` builds `dev` + PR previews; `finance-alumni-database` builds `prod` only),
      scoped via each project's *Ignored Build Step*

---

## Branching & CI (how we work now)

- **`prod`** — production branch; merges deploy production via `finance-alumni-database`.
- **`dev`** — integration branch for active work, deployed via `dev-fa-web-app`.
- Flow: branch off `dev` → PR into `dev` (base CI + dev preview must pass) → merge → PR `dev` → `prod`
  (the prod-only `Dependency audit` also runs) → merge to release.
- Direct pushes to `dev`/`prod` are rejected — everything goes through PRs.
- Required-approvals is **0** (solo-friendly): the **checks** are the gate, not reviews.
- Each branch builds only its own Vercel project (per-branch *Ignored Build Step*); the off-branch
  project reports a harmless "Canceled by Ignored Build Step" status.

---

## Immediate next steps

### 1. Real authentication on `/login` ✅
- [x] Convert the login form to a Client Component (`src/components/auth/LoginForm.tsx`)
- [x] Call `supabase.auth.signInWithPassword()` with email/password
- [x] Form validation with React Hook Form + Zod (`react-hook-form`, `zod`, `@hookform/resolvers`)
- [x] Loading + error states; redirect to a protected page on success (honors a
      same-origin `?next=` param; generic error so we don't leak which accounts exist)
- [x] `signOut()` action (`src/components/auth/SignOutButton.tsx`)

### 2. Protected routes
- [x] Extend `src/middleware.ts` to redirect unauthenticated users to `/login`
      (via `updateSession` in `src/utils/supabase/middleware.ts`; public paths = `/`, `/login`;
      authenticated users on `/login` bounce to `/dashboard`). Verified: unauth `/dashboard` → 307
      `/login?next=/dashboard`.
- [ ] Add an authenticated app shell (sidebar + top bar per `UX-UI.md`) — `/dashboard` currently
      has a minimal navy top bar only; full sidebar shell still to build
- [x] Wire the navy `finance-logo.jpg` into the header/login (navy surfaces only) — login card
      navy header band; dashboard top bar

### 3. API client layer
- [ ] Typed fetch wrapper around `NEXT_PUBLIC_API_URL` (FastAPI backend)
- [ ] Attach the Supabase access token to API requests
- [ ] React Query provider + base hooks
- [ ] Generate TypeScript types from `database/schema.sql` (reference copy)

### 4. Role-aware UI
- [ ] Read role (Full Access vs View Only) from the backend/session
- [ ] Hide edit/create/import/export/merge/upload controls for View Only
- [ ] (Authorization always enforced server-side — UI only reflects it)

---

## V1 feature screens (build order TBD)

- [ ] Dashboard — totals, by grad year / employer / industry / location, missing-data + duplicate counts
- [ ] Alumni search — server-side filtering across name, employer, title, industry, year, location, tags, status
- [ ] Alumni profile — contact, employment, education, notes, events, interactions, attachments, audit
- [ ] Geographic map — city/state clustering, employer overlays, drill-down
- [ ] Event management — create/edit events, attendance tracking, bulk assignment
- [ ] Duplicate management — review suggested duplicates, approve merges
- [ ] Audit history — change log with rollback
- [ ] File attachments — drag-and-drop upload via backend APIs
- [ ] CSV import/export — filtered exports, import with batch tracking

Required states for every data screen: **loading (skeleton), empty, error, view-only.**

---

## Project setup / housekeeping

- [x] ESLint config (flat) + `eslint-config-next`
- [ ] Add shadcn/ui + base component primitives
- [ ] Set up testing (auth flows, search, forms, role-based UI per `CLAUDE.md`) — add a test step to CI
- [ ] Add a transparent SVG/PNG primary logo + icon-only mark (see `UX-UI.md` to-do)
- [x] Configure Vercel project + environment variables for deployment

---

## Deployment

- **Live URL:** https://finance.alumni.byu.edu (prod; Vercel project `finance-alumni-database`)
- **Auto-deploy:** Git-connected, two projects — merge to `prod` deploys `finance-alumni-database`;
  `dev` + PRs deploy `dev-fa-web-app` (per-branch *Ignored Build Step*).
- [ ] Set `NEXT_PUBLIC_API_URL` in Vercel — the backend is now live
      (prod `https://fa-web-api.vercel.app`, dev `https://dev-fa-web-api.vercel.app`); until it's set,
      the API badge shows "not reachable" on the live site
- [x] Vercel deploys scoped per branch via each project's *Ignored Build Step* (replaces the old
      single "Production Branch" setting)
- [x] Add a custom domain when ready — live at `https://finance.alumni.byu.edu`

---

## Out of scope for V1

Per `CLAUDE.md` — do not build unless explicitly requested: public alumni directory, self-service
portal, email/outreach campaigns, surveys, saved searches/views, mass editing, social features.
