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

The application must still function on:

* Tablets
* Smaller laptops
* Mobile devices

Do not build desktop-only experiences.

All pages should remain usable on smaller screens.

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

The frontend should recognize two roles.

## Full Access

Can access:

* Edit screens
* Import screens
* Export actions
* Event management
* Duplicate management

## View Only

Can access:

* Read-only pages

Hide editing controls when appropriate.

The backend must still enforce permissions.

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
NEXT_PUBLIC_SUPABASE_ANON_KEY=

NODE_ENV=
```

Never hardcode secrets.

Only expose variables intended for client-side use.

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
* Alumni self-service portal
* Email campaign tools
* Survey systems
* Social networking features
* Public-facing marketing pages

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
