# CLAUDE.md

This file provides guidance to Claude Code when working in the fa-web-app repository.

> **Design system:** brand colors, typography, logos, and UI conventions live in `UX-UI.md` in this
> repo. Read it before doing any styling or visual work — it is the single source of truth for design.
> Brand assets are in `public/branding/`. The screen/feature inventory is `docs/Features.md` at the
> workspace root.
>
> **Database schema:** `database/schema.sql` is a **read-only reference copy** of the PostgreSQL
> schema for building types, forms, and API calls. The authoritative copy lives in the backend
> (`fa-web-api/database/schema.sql`) — do not edit this copy; sync it from the backend if it changes.

# Project Purpose

This repository contains the frontend web application for the BYU Finance Alumni Database.

Responsibilities:

* User interface
* Authentication flows
* Search experience
* Alumni profile pages
* Dashboard visualizations
* Event management screens
* File upload interfaces
* Reporting interfaces
* Administrative tools

This repository should focus on user experience and presentation.

Business logic should remain in the backend whenever possible.

---

# Technology Stack

Framework:

* Next.js App Router

Language:

* TypeScript

Styling:

* Tailwind CSS

UI Components:

* shadcn/ui

Data Fetching:

* React Query (TanStack Query)

Forms:

* React Hook Form
* Zod

Charts:

* Recharts

Maps:

* Mapbox or Leaflet

Authentication:

* Supabase Auth

Deployment:

* Vercel

---

# Architecture Principles

Frontend is responsible for:

* Presentation
* User interactions
* Form validation
* API communication
* State management

Frontend is not responsible for:

* Permission enforcement
* Business rules
* Security decisions
* Data integrity

Never trust frontend validation alone.

All important validation must also exist in the backend.

---

# Project Structure

Recommended structure:

```text
src/
├── app/
│
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── alumni/
│   ├── events/
│   └── shared/
│
├── hooks/
│
├── lib/
│
├── services/
│
├── types/
│
├── providers/
│
└── constants/
```

---

# Design Goals

The application should feel:

* Professional
* Modern
* Fast
* Easy to learn
* Easy to search

Primary users are:

* Career directors
* Operations staff
* Student employees
* Professors

Optimize for productivity over visual effects.

For all visual specifics — colors, typography, spacing, component styling, brand assets — follow
`UX-UI.md`.

---

# Responsive Design

Desktop is the primary target.

The application must also work well on:

* Tablets
* Smaller laptops
* Mobile devices

⚠️ **Mobile is DEFERRED — desktop first.** This overrides the aspiration below. Mobile polish is its
own phase, tracked as **fa-web-app #35 ("Mobile phase")**, and is not part of ordinary feature work.
Do not spend effort on touch ergonomics, bottom sheets or PWA install unless the task says so.

Practically: don't build something that *breaks* on a phone, and don't blank the phone-only `Topbar`
(it carries Sign out — see `UX-UI.md`). Beyond that, build for desktop and move on.

When the mobile phase does start, the target is a polished native feel rather than a shrunk-down
website — touch-first ergonomics, native navigation patterns, dense tables collapsing to cards, an
installable PWA. The **Mobile experience** section in `UX-UI.md` holds the concrete bar.

---

# Authentication

Authentication is required for all application pages.

Use Supabase Auth.

Requirements:

* Login page
* Logout functionality
* Session persistence
* Protected routes
* Permission-aware navigation

Never rely on frontend authorization for security.

Backend remains the source of truth.

---

# Authorization

⚠️ **There are FIVE roles, not two.** `src/constants/roles.ts` is the single source of truth on the
frontend — import from it rather than writing role literals. It mirrors the backend's
`app/core/roles.py`.

| Id | Label shown to users | Broadly |
| --- | --- | --- |
| `engineer` | Engineer | Highest — engineer console, DB + editable-vocabulary admin |
| `super_admin` | Super admin | Everything `full_access` has, plus user management |
| `full_access` | Full access | Edit, import, export, events, duplicates |
| `student` | Student | Limited editor |
| `view_only` | **Professor** | Read-only |

Note `view_only` displays as **"Professor"** — the id and the label deliberately differ, so never
render the raw id.

Hide editing controls when appropriate, but the backend must still enforce permissions. The frontend
never enforces security.

⚠️ **`view_only` seeing email and phone is INTENTIONAL** — faculty need them for outreach. Do not
"fix" it as a PII leak.

---

# Dashboard Requirements

Dashboard is a primary feature.

Display:

* Total alumni
* Alumni by employer
* Alumni by industry
* Alumni by graduation year
* Geographic distribution
* Event statistics
* Missing data counts
* Duplicate counts

Prioritize clarity and usability.

Avoid clutter.

---

# Search Requirements

Search is a core workflow.

Support:

* Name
* Employer
* Job title
* Industry
* Graduation year
* City
* State
* Tags
* Status labels

Support multiple filters simultaneously.

Search should feel responsive and fast.

---

# Alumni Profile Pages

Each alumni profile should display:

## Contact Information

* Name
* Email
* Phone
* LinkedIn
* Location

## Employment Information

* Current employer
* Current title
* Employment history

## Education Information

* Graduation year
* Degree information

## Engagement Information

* Notes
* Events attended
* Interactions
* Attachments

## Audit Information

Visible only to authorized users.

---

# Tables

Data tables are heavily used throughout the application.

Requirements:

* Sorting
* Filtering
* Pagination
* Column resizing if practical
* Loading states
* Empty states

Avoid rendering large datasets without pagination.

---

# Forms

Use:

* React Hook Form
* Zod validation

Requirements:

* Client-side validation
* Helpful error messages
* Loading states
* Success feedback

Forms should be easy to complete quickly.

---

# File Uploads

Users may upload:

* PDFs
* Resumes
* Meeting notes
* Documents

Requirements:

* Drag-and-drop support
* Progress indicators
* Upload success feedback
* Upload failure feedback

Files are stored through backend APIs.

---

# Event Management

Support:

* Event creation
* Event editing
* Event attendance tracking
* Bulk attendance assignment

Attendance workflows should be efficient.

---

# Geographic Visualization

Support:

* Map clustering
* State-level views
* City-level views
* Employer overlays

Maps should remain performant with thousands of alumni.

---

# Charts and Analytics

Use Recharts.

Requirements:

* Graduation trends
* Employer distribution
* Industry distribution
* Geographic distribution
* Attendance analytics

Charts should prioritize readability.

Avoid excessive animation.

---

# Error Handling

Every page should support:

* Loading state
* Empty state
* Error state

Users should always understand what happened.

Avoid exposing technical errors.

---

# Accessibility

Requirements:

* Keyboard navigation
* Proper labels
* Semantic HTML
* Color contrast compliance

Accessibility should be considered during development.

---

# Performance Goals

Targets:

* Initial page load under 3 seconds
* Search results under 1 second
* Smooth navigation
* Minimal layout shifts

Use:

* Server components where appropriate
* Lazy loading where appropriate
* Code splitting where appropriate

---

# API Usage

All data should come from backend APIs.

Do not:

* Access the database directly
* Recreate backend business logic
* Implement permission rules only in the frontend

Backend APIs remain the source of truth.

---

# Environment Variables

Expected variables:

```env
NEXT_PUBLIC_API_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Optional (#774) — the "email us directly" link at the foot of the PUBLIC
# survey. Unset means the control renders nothing, by design.
NEXT_PUBLIC_SURVEY_CONTACT_NAME=
NEXT_PUBLIC_SURVEY_CONTACT_EMAIL=

NODE_ENV=
```

Never hardcode secrets.

Only expose variables intended for client-side use.

---

# Local Development

Install and run:

```bash
npm install
npm run dev:local    # NEXT_PUBLIC_API_URL → http://localhost:8000 (use when running fa-web-api locally)
# npm run dev:remote # NEXT_PUBLIC_API_URL → https://dev-fa-web-api.vercel.app
# npm run dev        # uses NEXT_PUBLIC_API_URL from .env as-is
```

App runs at http://localhost:3000.

**The middleware builds a Supabase client on every request**, so if
`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is missing,
**every route returns 500**. These two (plus `NEXT_PUBLIC_API_URL`) are the only
vars the app *requires* — the two `NEXT_PUBLIC_SURVEY_CONTACT_*` vars above are
optional and their absence only hides one link. Pull them from the Vercel project matching your target with
`vercel env pull` — they are browser-safe (publishable) keys, matching the same
environment's `fa-web-api`.

> **Database split: DONE (2026-07-09).** `dev` and `prod` use **separate Supabase
> projects**, so their `NEXT_PUBLIC_SUPABASE_URL` / `…_PUBLISHABLE_KEY` genuinely
> differ — `dev-fa-web-app` uses the dev project, `finance-alumni-database` (prod)
> uses the dedicated prod project. Pull from the project matching your target.
>
> ⚠️ **The committed `.env` points `NEXT_PUBLIC_API_URL` at PROD**, not dev. Before
> trusting any API base URL, `curl <url>/health` and read the `environment` field.
> More than one confusing afternoon has started here.
>
> ⚠️ **prod is real alumni data.** Never point local work at it for anything
> destructive, and never run scratch queries against the prod database.

The landing page (`/`) renders an **`ApiStatus`** badge that pings the API's
`/health` and shows "API connected" / "API not reachable" — a quick visual check
that the frontend can reach the backend.

---

# Security Requirements

Never:

* Store secrets in local storage
* Expose private API keys
* Trust user-provided permissions
* Store sensitive data unnecessarily

Use secure authentication practices.

---

# Testing Requirements

Minimum testing areas:

* Authentication flows
* Search workflows
* Dashboard rendering
* Form validation
* File uploads
* Role-based UI behavior

Use component and integration testing where appropriate.

---

# UI Guidelines

Prefer:

* Clean layouts
* Consistent spacing
* Clear typography
* Predictable navigation

Avoid:

* Excessive animations
* Overly complex dashboards
* Visual clutter

The application is a professional internal business tool.

See `UX-UI.md` for the concrete color, typography, and component specifications.

---

# Out of Scope

Do not build unless specifically requested:

* Public alumni directory
* Social networking features
* Public-facing marketing pages

⚠️ **Three items were removed from this list because they were subsequently requested and BUILT.**
Do not treat them as out of scope:

* **Survey system** — live at `/survey/[token]`. The app's one genuinely public surface: the root
  middleware's `isNoAuthPath` makes `/survey/*` skip authentication entirely, so a visitor is a
  stranger holding a signed token, not a user. Never import auth/session/user code into it, and never
  reuse `TopNav` there — every link would bounce them to login.
* **Email campaign tools** — survey campaigns, scheduling, reminders and a send cap live in the
  engineer console.
* **Alumni self-service** — alumni update their own record through the survey.

---

# Development Principles

1. User productivity first
2. Simplicity over complexity
3. Consistency over novelty
4. Accessibility matters
5. Mobile compatibility matters
6. Keep business logic in the backend
7. Keep components reusable
8. Ask before introducing major architectural changes

When in doubt, optimize for speed, clarity, maintainability, and ease of use.
