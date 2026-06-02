# NEXT-STEPS.md — fa-web-app

Running checklist of what's done and what's next for the BYU Finance Alumni Database frontend.
Update as work progresses. Scope and rules live in `CLAUDE.md` (architecture) and `UX-UI.md` (design).

---

## Done

- [x] Next.js App Router + TypeScript + Tailwind scaffold
- [x] Brand palette + Inter font wired into `tailwind.config.ts` (from `UX-UI.md`)
- [x] Placeholder home page (`/`)
- [x] Placeholder login page (`/login`) — disabled form, no auth logic yet
- [x] Typed env accessor (`src/lib/env.ts`) + `.env.example`
- [x] Supabase SSR clients (browser/server) + session-refresh middleware
- [x] Temporary API connection indicator on home page (`ApiStatus`, Lucide icons)
- [x] **Deployed live to Vercel** → https://fa-web-app-five.vercel.app
      (project `gunnjakes-projects/fa-web-app`; Supabase env vars set for production)

---

## Immediate next steps

### 1. Real authentication on `/login`
- [ ] Convert the login form to a Client Component
- [ ] Call `supabase.auth.signInWithPassword()` with email/password
- [ ] Form validation with React Hook Form + Zod
- [ ] Loading + error states; redirect to a protected page on success
- [ ] `signOut()` action

### 2. Protected routes
- [ ] Extend `src/middleware.ts` to redirect unauthenticated users to `/login`
- [ ] Add an authenticated app shell (sidebar + top bar per `UX-UI.md`)
- [ ] Wire the navy `finance-logo.jpg` into the header/login (navy surfaces only)

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

- [ ] Add ESLint config + `eslint-config-next` (the `lint` script exists; config not added yet)
- [ ] Add shadcn/ui + base component primitives
- [ ] Set up testing (auth flows, search, forms, role-based UI per `CLAUDE.md`)
- [ ] Add a transparent SVG/PNG primary logo + icon-only mark (see `UX-UI.md` to-do)
- [x] Configure Vercel project + environment variables for deployment

---

## Deployment

- **Live URL:** https://fa-web-app-five.vercel.app
- **Deploy command:** `vercel --prod` (manual, from this repo)
- [ ] **Enable push-to-deploy** — GitHub auto-connect failed because the repo is private +
      org-owned (needs Vercel Pro). Options: upgrade to Pro, transfer repo to a personal account,
      or keep deploying manually via CLI.
- [ ] Set `NEXT_PUBLIC_API_URL` in Vercel once the FastAPI backend is deployed to a public URL
      (currently unset in prod, so the API badge shows "not reachable" on the live site)
- [ ] Add a custom domain when ready

---

## Out of scope for V1

Per `CLAUDE.md` — do not build unless explicitly requested: public alumni directory, self-service
portal, email/outreach campaigns, surveys, saved searches/views, mass editing, social features.
