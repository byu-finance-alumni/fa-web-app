# UX-UI.md — fa-web-app Design System

The visual design system for the BYU Finance Alumni Database frontend: brand assets, color tokens,
typography, and UI conventions. `CLAUDE.md` in this repo holds the engineering/architecture context;
this file is the single source of truth for **design**. Read both.

> Stack: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + React Query.
> Screen/feature inventory lives in `docs/Features.md` at the workspace root.

---

## Styling framework (hard rule)

**Tailwind CSS is the one and only styling framework for this app.** All styling is done with
Tailwind utility classes (and the shadcn/ui components built on top of Tailwind).

- **Do not add Bootstrap** — or any other CSS framework (Bulma, Foundation, Materialize, Ant,
  MUI, Chakra, etc.). They collide with Tailwind's reset and utilities, bloat the bundle, and fight
  shadcn/ui. One framework, no exceptions.
- No competing global stylesheets, no `!important` overrides to undo another library, no CDN
  `<link>` to a third-party CSS framework.
- Style with Tailwind utilities first; reach for a small amount of custom CSS (via `@layer` /
  CSS variables) only when a utility genuinely can't express it.
- Reference design tokens by their Tailwind class names (see Color system below) — **never hardcode
  hex values in JSX.**

---

## Brand assets

Located in `fa-web-app/public/branding/`:

| File | Use |
| --- | --- |
| `finance-logo.jpg` | Primary logo — solid navy block, "BYU Finance / Marriott School of Business". Top header and login. |
| `finance-logo-secondary.jpg` | Secondary "BYU FINANCE" gradient lockup. Use sparingly (splash/marketing). |
| `marriott-school-inside.jpg` | Tanner Building atrium photo — login hero / empty-state backdrop. |
| `marriott-school-outside.jpg` | Tanner Building exterior — login hero / banner. |

**To-do (not blocking):** request a **transparent SVG/PNG** of the primary logo (the `.jpg` has a
baked navy background that looks wrong on light surfaces) plus an **icon-only mark** for the
collapsed sidebar and favicon. Until then, use the navy `finance-logo.jpg` only on navy/white
surfaces.

This is a **BYU Marriott School** product — follow official BYU branding where possible. The palette
below is derived from the two supplied logos and aligned to BYU's official navy.

---

## Color system

Derived directly from the brand logos:
- `finance-logo.jpg` → navy **`#1C2E54`** (primary brand block)
- `finance-logo-secondary.jpg` → deep royal blue **`#053160`**, which aligns with BYU's official
  navy **`#002E5D`**.

### Brand / primary (navy & blue)

| Token | Hex | Use |
| --- | --- | --- |
| `navy-900` | `#0F1B33` | Darkest — text on light, deepest backgrounds |
| `navy-800` | `#1C2E54` | **Primary brand navy** (header, sidebar, primary buttons) — from primary logo |
| `navy-700` | `#243B6B` | Hover/active on navy surfaces |
| `royal-700` | `#002E5D` | BYU official navy — deep accents, gradients |
| `blue-600` | `#2E4A86` | Primary interactive (buttons, links, active nav) |
| `blue-500` | `#3B5C9A` | Hover state for primary interactive |
| `blue-300` | `#9DB2D8` | Subtle accents, borders on navy, disabled-on-navy |
| `blue-50`  | `#EEF2FA` | Selected rows, info backgrounds, hover tint on light |

### Neutrals (gray)

| Token | Hex | Use |
| --- | --- | --- |
| `gray-900` | `#111827` | Primary body text |
| `gray-700` | `#374151` | Secondary text, labels |
| `gray-500` | `#6B7280` | Muted/placeholder text, icons |
| `gray-300` | `#D1D5DB` | Borders, dividers |
| `gray-100` | `#F3F4F6` | Page background, table header fill |
| `gray-50`  | `#F9FAFB` | Cards / raised surfaces on gray bg |
| `white`    | `#FFFFFF` | Surfaces, text on navy |

### Semantic / status

| Token | Hex | Use |
| --- | --- | --- |
| `success-600` | `#15803D` | Verified data, completed tasks, success toasts |
| `success-50`  | `#ECFDF3` | Success background tint |
| `warning-600` | `#B45309` | **Missing-data badges**, due-soon, caution |
| `warning-50`  | `#FEF6E7` | Warning background tint |
| `danger-600`  | `#B42318` | **Duplicate warnings**, destructive (archive/delete), errors |
| `danger-50`   | `#FEF3F2` | Danger background tint |
| `info-600`    | `#2E4A86` | Informational (reuse `blue-600`) |

### Data-viz palette (charts, map clusters, tags)

Sequential blues for cohort/employer/industry charts; keep categorical hues distinct but on-brand:
`#1C2E54`, `#2E4A86`, `#3B5C9A`, `#5B7BC0`, `#8AA4D6`, then accent with `#15803D` (green),
`#B45309` (amber), `#7C3AED` (violet), `#0E7490` (teal) for additional categories. Use with Recharts.

### Tailwind mapping

Add these to `tailwind.config.ts` under `theme.extend.colors` as `navy`, `royal`, `brand-blue`,
plus standard `gray`/semantic scales. shadcn/ui CSS variables (`--primary`, `--destructive`, etc.)
should map to these tokens. Reference tokens by name in components — **never hardcode hex values in
JSX**.

---

## Typography

- **UI font:** Inter (or system stack `ui-sans-serif`) for all app text — clean, dense, legible in
  data tables. BYU's official font is **HCo Ringside**; if licensed, use it for headings/logo lockups
  only, otherwise Inter throughout.
- **Numeric/tabular:** use `font-variant-numeric: tabular-nums` for counts, years, and table figures
  so columns align.
- **Scale:** page title 24–30px/600 · section heading 18–20px/600 · body 14px/400 · table & meta
  13px/400 · label/caption 12px/500 uppercase tracking-wide.

---

## Layout & UX conventions

- **App shell:** fixed left sidebar (navy `navy-800`) + top bar; content area on `gray-100`.
- **Breadcrumbs:** every screen below the top level shows a breadcrumb trail in the top bar so users
  always know where they are in the hierarchy (e.g. `Alumni / Jane Smith`, `Events / Spring Mixer /
  Attendance`). Conventions: render with the shadcn/ui `Breadcrumb` component; the **last crumb is
  the current page** (not a link, `gray-900`), ancestor crumbs are links (`blue-600`); separators are
  the Lucide `chevron-right` icon; the first crumb is the section root (the sidebar item), not
  "Home"; truncate long middle crumbs with an ellipsis rather than wrapping. Top-level section pages
  (Dashboard, Alumni list, Events list) show no breadcrumb. On mobile, collapse to a single
  **back affordance** (`‹ Parent`) instead of the full trail — it pairs with the full-screen drill-down
  pushes in the Mobile experience section.
- **Density:** this is a data-heavy CRM for 10,000+ records — favor compact tables, sticky table
  headers, and server-side pagination over spacious marketing layouts.
- **Cards/surfaces:** white on `gray-100`, `gray-300` 1px borders, subtle shadow, ~8px radius.
- **Primary action** = `blue-600` solid; **secondary** = white with `gray-300` border; **destructive**
  = `danger-600`. One primary action per view.
- **Role-aware UI:** render a **View-Only** variant of every screen — for faculty, edit/create/
  import/export/merge/upload controls are hidden (not just disabled). Authorization is always
  enforced server-side; the UI only reflects it.
- **Required states for every data screen:** loading (skeleton), empty, error, and view-only.
- **Badges/chips:** tags = `blue-50`/`navy-800` text; status labels = neutral; missing-data =
  `warning`; duplicate = `danger`; archived/deceased = muted gray.

---

## Don't look AI-generated (hard rule)

The UI must read as a **deliberately designed, human-crafted internal tool** — not a generic
LLM/template default. Tasteful, specific, and on-brand beats flashy. Avoid the tells that scream
"AI generated":

- **No generic gradient-and-emoji landing look:** no purple→indigo hero gradients, no glassmorphism
  blur cards, no floating emoji as section icons (use Lucide line icons), no "🚀 Supercharge your
  workflow" marketing copy. This is a CRM for staff, not a SaaS splash page.
- **Use the real brand palette,** not Tailwind's default `indigo-500`/`violet-600`/`slate` straight
  out of the box. Every color must map to a token in the Color system above (navy/blue/BYU navy).
- **Write real copy.** No lorem ipsum, no placeholder "Card Title / Card description goes here," no
  invented stats. Labels match the actual data model and the language staff use.
- **Specific spacing and hierarchy,** not uniform `gap-4 p-4` everywhere. Make intentional choices:
  dense tables, real alignment, purposeful whitespace — see Density below.
- **No decorative filler:** drop empty "Features" grids of 3 identical cards, fake testimonials,
  redundant hero sections, and centered-everything layouts. Every element earns its place.
- **Restraint over effects:** minimal animation, no gratuitous shadows/rounded-pill-everything, no
  rainbow charts. Professional, calm, fast (this echoes the engineering CLAUDE.md's "avoid excessive
  animations / visual clutter").
- **Consistency:** reuse the established shadcn/ui components and tokens rather than one-off bespoke
  styling per screen. Sameness here is a feature.

Litmus test: if a screen looks like it could belong to any random AI-scaffolded app, it's not done.
It should look like **the BYU Finance Alumni Database** specifically.

---

## Mobile experience

Desktop is the primary target, but **mobile is not an afterthought — on a phone the app must feel
like a polished native app, not a shrunk-down website.** Staff will pull this up on their phones
between meetings and at events; it has to be genuinely good, not merely "usable."

What "native-feeling" means here:

- **Touch-first ergonomics:** minimum 44×44px tap targets; primary actions reachable in the thumb
  zone (bottom of the screen, not buried in a top corner). Generous spacing between tappable rows.
- **Native navigation patterns:** a **bottom tab bar** for top-level sections on mobile (not the
  desktop sidebar squeezed in); full-screen pushes for drill-downs; swipe-back where it fits.
- **Sheets over modals:** use bottom sheets / slide-up panels for filters, actions, and detail
  peeks — the pattern users expect from native apps — rather than centered desktop dialogs.
- **Responsive data display:** the dense desktop tables collapse to **stacked cards or list rows**
  on mobile; never force horizontal scrolling through a wide table. Sticky search/filter at top.
- **Performance & feel:** momentum scrolling, instant tap feedback (active/pressed states), skeleton
  loaders, and no layout shift. Interactions should feel immediate (<100ms perceived response).
- **Respect the device:** safe-area insets (notch/home indicator), large-text/Dynamic-Type support,
  honor system light/dark and reduced-motion preferences.
- **Installable:** ship a proper PWA — web-app manifest, app icon, theme color, and a standalone
  display mode so it launches chrome-free from the home screen like a real app.

Test every primary workflow (search, view a profile, log an interaction, check the dashboard) on a
real phone-sized viewport before considering a screen done. If a flow feels awkward with a thumb,
it isn't finished.

---

## Iconography

Use **Lucide** (consistent, MIT-licensed, React-ready, pairs with shadcn/ui). Do not import multiple
icon sets. Common: search, sliders/filter, edit, archive, upload, download, map-pin, users, calendar,
bar-chart, tag, alert-triangle (missing data), copy/merge (duplicates), history (audit).

---

## Accessibility

- Maintain WCAG AA contrast: navy `navy-800`/`royal-700` on white and white on navy all pass; never
  put `blue-300` text on white for body copy.
- Don't encode meaning by color alone — pair status colors with an icon or label (missing-data badge
  has both a color and text).
- All interactive elements keyboard-reachable with a visible focus ring (`blue-500`).
