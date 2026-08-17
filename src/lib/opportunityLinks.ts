/**
 * Opportunity links (api #441) — the shared, pure logic behind the Links tab.
 *
 * Everything the list page, the toolbar, the add form and the server actions
 * need to agree on lives here: the filter shape, the ONE serializer that turns
 * that shape into a URL, the ONE function that turns the same shape into the
 * backend query, and the display rules for the two columns whose value the
 * backend can legitimately return as `null`.
 *
 * WHY THE API QUERY IS DERIVED FROM THE URL STATE rather than built beside it.
 * This repo has been bitten repeatedly by two lists that are *supposed* to be
 * the same query drifting apart (see `alumniFilterParams.ts` and the
 * export/list parity note): the moment "what the URL says" and "what we ask the
 * backend for" are assembled by two separate blocks of code, a filter gets added
 * to one and not the other and the screen quietly lies. So
 * {@link toLinksApiQuery} takes the same `LinksFilterState` the URL round-trips
 * through {@link parseLinksFilters} / {@link toLinksQs}, and nothing else.
 *
 * SECURITY NOTE. `url` and `details` on a link are PUBLIC-submitted — an alum
 * types them into the survey and staff read them from an authenticated session.
 * Nothing here renders; the render sites are responsible for passing `url`
 * through `safeExternalHref` (`@/lib/urlSafety`) and for never handing any field
 * to `dangerouslySetInnerHTML`. {@link validateOpportunityUrl} is the INPUT-side
 * half of that pair, used by the staff add form. As with the LinkedIn rule,
 * neither side IS the control — the backend re-validates on write.
 */
import type { Schema } from "@/types/api";
import { safeExternalHref } from "@/lib/urlSafety";

export type OpportunityLink = Schema<"OpportunityLinkRead">;
export type OpportunityLinkCreate = Schema<"OpportunityLinkCreate">;
export type OpportunityLinkPage = Schema<"OpportunityLinkPage">;

export type LinkStatus = OpportunityLink["status"];
export type LinkRoleType = OpportunityLink["role_type"];

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

/** Role types in the order the owner listed them (Internship / Full-time / Both). */
export const ROLE_TYPES = ["internship", "full_time", "both"] as const;

/** Display labels for `role_type`. The stored values are snake_case codes. */
export const ROLE_TYPE_LABELS: Record<LinkRoleType, string> = {
  internship: "Internship",
  full_time: "Full-time",
  both: "Both",
};

export const STATUSES = ["approved", "pending", "rejected"] as const;

export const STATUS_LABELS: Record<LinkStatus, string> = {
  approved: "Approved",
  pending: "Pending review",
  rejected: "Rejected",
};

/**
 * What `GET /opportunity-links` returns when `status` is omitted. Stated once so
 * the toolbar's default selection and the URL serializer's "omit the default"
 * rule can never disagree with the backend.
 */
export const DEFAULT_STATUS: LinkStatus = "approved";

/** Page size for the list. Matches the audit log's 50-row pages. */
export const LINKS_PAGE_SIZE = 50;

/**
 * Mirrors the LinkedIn cap and the `String(500)` columns elsewhere in this
 * schema. The backend is the real cap; this exists so the form can say so before
 * a round-trip.
 */
export const OPPORTUNITY_URL_MAX_LEN = 500;

/**
 * How old a link may get before the list flags it.
 *
 * There is deliberately NO auto-expiry (owner's call on #441) — a careers page
 * stays valid for years while a specific posting dies in weeks, and silently
 * hiding rows would make staff trust a list that is quietly dropping things.
 * Instead the age is always on screen and anything past this threshold is
 * *marked*, so a stale link is obvious without being removed.
 */
export const STALE_AFTER_DAYS = 90;

const isRoleType = (v: unknown): v is LinkRoleType =>
  typeof v === "string" && (ROLE_TYPES as readonly string[]).includes(v);

const isStatus = (v: unknown): v is LinkStatus =>
  typeof v === "string" && (STATUSES as readonly string[]).includes(v);

/* ------------------------------------------------------------------ *
 * Filter state — URL in, backend query out
 * ------------------------------------------------------------------ */

/** Every filter the Links list supports, mirrored in the URL. */
export interface LinksFilterState {
  /** Free-text search over company, details, location and url. */
  q: string;
  /** Moderation state. Always concrete — `DEFAULT_STATUS` when unset. */
  status: LinkStatus;
  /** Internship / full-time / both, or "" for any. */
  role_type: "" | LinkRoleType;
  /** Substring match on the company the link is listed under. */
  company: string;
}

export const EMPTY_LINKS_FILTERS: LinksFilterState = {
  q: "",
  status: DEFAULT_STATUS,
  role_type: "",
  company: "",
};

/** The raw `searchParams` shape the route hands us. */
export type LinksSearchParams = {
  q?: string;
  status?: string;
  role_type?: string;
  company?: string;
  offset?: string;
};

/**
 * Read filter state out of the URL. Unknown/garbage values fall back to the
 * default rather than being forwarded — a hand-edited `?status=all` must not
 * become a 422 from the backend.
 */
export function parseLinksFilters(sp: LinksSearchParams): LinksFilterState {
  return {
    q: sp.q ?? "",
    status: isStatus(sp.status) ? sp.status : DEFAULT_STATUS,
    role_type: isRoleType(sp.role_type) ? sp.role_type : "",
    company: sp.company ?? "",
  };
}

/** Read the paging offset out of the URL. Negative / non-numeric → 0. */
export function parseLinksOffset(sp: LinksSearchParams): number {
  const n = Number(sp.offset ?? "0");
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

/**
 * Serialize filter state to the canonical `/links` query string. Defaults are
 * omitted so a clean list has a clean URL (the convention every other toolbar in
 * this app follows).
 */
export function toLinksQs(f: LinksFilterState): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.status !== DEFAULT_STATUS) p.set("status", f.status);
  if (f.role_type) p.set("role_type", f.role_type);
  if (f.company.trim()) p.set("company", f.company.trim());
  return p.toString();
}

/** `/links` href for a filter state (and optionally a page offset). */
export function linksHref(f: LinksFilterState, offset = 0): string {
  const p = new URLSearchParams(toLinksQs(f));
  if (offset > 0) p.set("offset", String(offset));
  const qs = p.toString();
  return qs ? `/links?${qs}` : "/links";
}

/**
 * The backend query for a filter state — DERIVED from the same object the URL
 * round-trips, never assembled separately (see the module header).
 *
 * `status` is sent explicitly even when it equals the backend's default: the one
 * thing worse than a redundant param is a list whose contents depend on an
 * implicit default we then have to remember on both ends.
 */
export function toLinksApiQuery(
  f: LinksFilterState,
  { limit = LINKS_PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {},
): string {
  const p = new URLSearchParams();
  p.set("status", f.status);
  if (f.role_type) p.set("role_type", f.role_type);
  if (f.company.trim()) p.set("company", f.company.trim());
  if (f.q.trim()) p.set("q", f.q.trim());
  p.set("limit", String(limit));
  p.set("offset", String(offset));
  return p.toString();
}

/**
 * Whether a filter state is anything other than "the default view" — drives the
 * Clear button's enabled state and the "no results" copy.
 */
export function hasActiveLinkFilters(f: LinksFilterState): boolean {
  return toLinksQs(f) !== "";
}

/* ------------------------------------------------------------------ *
 * Display rules
 * ------------------------------------------------------------------ */

/** The placeholder every "we have nothing to show here" cell renders. */
export const EM_DASH = "—";

export interface CompanyDisplay {
  /** What the cell prints. */
  label: string;
  /** The link was submitted as "my own company". */
  ownCompany: boolean;
  /**
   * True when the alum ticked "my company" and the backend could not resolve a
   * name — they have no employer on file. The list shows a dash rather than
   * inventing one, and marks the row so staff know the gap is in OUR data, not
   * in the submission.
   */
  unresolved: boolean;
}

/**
 * How the Company column reads for one link.
 *
 * `company_name` on `OpportunityLinkRead` is already the RESOLVED name — the
 * backend looks up the alum's current employer at read time for "my company"
 * entries, so it follows a job change and we must not re-derive it here. The one
 * case the frontend has to handle is the documented `null`: own-company with no
 * employer on file.
 */
export function companyDisplay(
  link: Pick<OpportunityLink, "company_name" | "is_own_company">,
): CompanyDisplay {
  const name = (link.company_name ?? "").trim();
  if (name !== "") {
    return { label: name, ownCompany: link.is_own_company, unresolved: false };
  }
  return {
    label: EM_DASH,
    ownCompany: link.is_own_company,
    unresolved: link.is_own_company,
  };
}

/** "Provo, UT" / "Provo" / "UT" / "—" from the two nullable location columns. */
export function locationDisplay(
  link: Pick<OpportunityLink, "location_city" | "location_state">,
): string {
  const city = (link.location_city ?? "").trim();
  const state = (link.location_state ?? "").trim();
  if (city && state) return `${city}, ${state}`;
  return city || state || EM_DASH;
}

export interface LinkTarget {
  /**
   * The href to render, or `null` when the stored value is not a safe absolute
   * `http(s)` URL. On `null` the caller MUST render {@link LinkTarget.label} as
   * plain text with no anchor — a dead value is more honest than a live link
   * pointing somewhere we did not intend.
   */
  href: string | null;
  /** What the cell prints. Never HTML; React escapes it. */
  label: string;
}

/** Longest link label before it is truncated, so the column stays readable. */
const LINK_LABEL_MAX = 48;

/**
 * Turn one stored `url` into a render-ready href + label.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE: the value came from the public
 * survey, and staff click it from an authenticated session. It goes through
 * `safeExternalHref` — WHATWG-parsed, `http:`/`https:` only — before it can
 * become an `href`, so `javascript:…` is never a script a reviewer runs by
 * clicking. When the guard rejects the value we still SHOW it (staff need to see
 * what was submitted in order to reject it), just never as a link.
 *
 * The label is built from the PARSED url, not the raw string, so what is
 * displayed matches what the browser would actually navigate to.
 */
export function linkTarget(raw: string | null | undefined): LinkTarget {
  const safe = safeExternalHref(raw);
  if (safe === null) {
    const shown = (raw ?? "").trim();
    return { href: null, label: shown === "" ? EM_DASH : truncate(shown) };
  }
  const url = new URL(safe);
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return {
    href: safe,
    label: truncate(`${url.host}${path}${url.search}`),
  };
}

function truncate(s: string): string {
  return s.length <= LINK_LABEL_MAX ? s : `${s.slice(0, LINK_LABEL_MAX - 1)}…`;
}

/** Who submitted it, or a dash — the backend nulls the name for deleted users. */
export function submittedByDisplay(
  link: Pick<OpportunityLink, "submitted_by">,
): string {
  return (link.submitted_by ?? "").trim() || EM_DASH;
}

/** "Mar 4, 2026" — the submitted/deadline date format used across the app. */
export function formatLinkDate(iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Whole calendar days between `iso` and `now`, or `null` when `iso` isn't a
 * date. Calendar days (not elapsed hours) so "yesterday evening" reads as 1 day
 * rather than 0.
 */
export function daysSince(
  iso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
}

/**
 * The age label that sits under the submitted date. The owner asked for the age
 * to be visible precisely because nothing expires — this is the whole reason the
 * column exists.
 */
export function linkAgeLabel(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  const days = daysSince(iso, now);
  if (days === null) return EM_DASH;
  if (days <= 0) return "Today";
  if (days === 1) return "1 day old";
  return `${days} days old`;
}

/** Past {@link STALE_AFTER_DAYS}. Marked in the list, never hidden. */
export function isStaleLink(
  iso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const days = daysSince(iso, now);
  return days !== null && days > STALE_AFTER_DAYS;
}

/** A deadline already in the past — worth flagging next to a live-looking link. */
export function isDeadlinePassed(
  iso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const days = daysSince(iso, now);
  return days !== null && days > 0;
}

/* ------------------------------------------------------------------ *
 * Input-side validation (staff add form)
 * ------------------------------------------------------------------ */

/**
 * Validate one opportunity URL. Returns an error message, or `null` when valid.
 *
 * Scheme-gated through `safeExternalHref`, exactly like `validateLinkedinUrl` —
 * but with NO hostname allow-list, because an opportunity link points at an
 * arbitrary employer site by design. That is the documented limit of this
 * control: it stops `javascript:` reaching an `href`, and it cannot tell a real
 * careers page from a phishing page. Approval by a human does not close that gap
 * either (see the `_valid_linkedin_url` docstring in the backend). The value of
 * the check is that the render side is never the weak point.
 */
export function validateOpportunityUrl(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return "Enter the link URL.";
  if (v.length > OPPORTUNITY_URL_MAX_LEN)
    return `Must be ${OPPORTUNITY_URL_MAX_LEN} characters or fewer.`;
  if (safeExternalHref(v) === null)
    return "Enter a full http:// or https:// URL, e.g. https://example.com/careers.";
  return null;
}

/** The staff add form's field values, before they become an API body. */
export interface AddLinkFormValues {
  alumniId: number | null;
  isOwnCompany: boolean;
  companyName: string;
  url: string;
  locationCity: string;
  locationState: string;
  roleType: LinkRoleType;
  applicationDeadline: string;
  details: string;
}

export const EMPTY_ADD_LINK_FORM: AddLinkFormValues = {
  alumniId: null,
  isOwnCompany: false,
  companyName: "",
  url: "",
  locationCity: "",
  locationState: "",
  roleType: "internship",
  applicationDeadline: "",
  details: "",
};

/** Field-keyed validation errors for {@link AddLinkFormValues}. */
export type AddLinkErrors = Partial<
  Record<"alumniId" | "companyName" | "url", string>
>;

/**
 * Client-side validation for the staff add form. Only the three fields that can
 * be *wrong* rather than merely empty are checked here; everything else is
 * optional on the backend model. As always this is UX, not enforcement.
 */
export function validateAddLink(v: AddLinkFormValues): AddLinkErrors {
  const errors: AddLinkErrors = {};
  if (v.alumniId === null) errors.alumniId = "Choose the alumnus this link is from.";
  // The checkbox and the typed name are alternatives, not both: ticking "their
  // own company" is what tells the backend to resolve the employer at read time,
  // so a typed name alongside it would be dead data.
  if (!v.isOwnCompany && v.companyName.trim() === "")
    errors.companyName = "Enter the company name, or tick their own company.";
  const urlError = validateOpportunityUrl(v.url);
  if (urlError) errors.url = urlError;
  return errors;
}

/** Turn validated form values into the `POST /opportunity-links` body. */
export function toCreateBody(v: AddLinkFormValues): OpportunityLinkCreate {
  const trimmedOrNull = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    alumni_id: v.alumniId as number,
    is_own_company: v.isOwnCompany,
    // Ticking the checkbox means the name is resolved from the employer record,
    // so we send nothing rather than a stale copy of it.
    company_name: v.isOwnCompany ? null : trimmedOrNull(v.companyName),
    url: v.url.trim(),
    location_city: trimmedOrNull(v.locationCity),
    location_state: trimmedOrNull(v.locationState),
    role_type: v.roleType,
    application_deadline: trimmedOrNull(v.applicationDeadline),
    details: trimmedOrNull(v.details),
  };
}

/* ------------------------------------------------------------------ *
 * Local-only sample data — the gate
 * ------------------------------------------------------------------ */

/**
 * The env var that turns on the fabricated sample rows (see
 * `opportunityLinks.sample.ts`). Server-only on purpose: a `NEXT_PUBLIC_` name
 * would be baked into the browser bundle at build time, and this must be a
 * runtime decision made on a developer's own machine.
 */
export const SAMPLE_LINKS_FLAG = "SAMPLE_OPPORTUNITY_LINKS";

/**
 * Whether to serve fabricated sample links instead of calling the API.
 *
 * TWO independent conditions, both required, and each one alone is already
 * enough to keep this off everywhere that matters:
 *
 *  1. `NODE_ENV === "development"`. Every Vercel build — dev project and prod
 *     project alike — builds and runs with `NODE_ENV=production`. There is no
 *     deployment of this app on which this is true.
 *  2. `SAMPLE_OPPORTUNITY_LINKS=1`. An explicit opt-in that exists in no Vercel
 *     project's environment. It is set by the `npm run dev:sample` script and
 *     nowhere else.
 *
 * The sample module is only ever reached through a dynamic `import()` guarded by
 * this function. Verified against a real `next build`: the fabricated rows
 * appear in NO browser bundle at all (they are server-only), and on the server
 * they are emitted as their own lazily-loaded chunk that nothing ever requires,
 * rather than being linked into the page's module graph.
 *
 * And because sample rows carry ids that exist in no database, every write path
 * (create / approve / reject) refuses outright while this is on, rather than
 * sending a request built from fake data at whatever API the environment
 * happens to point to. See `src/app/(app)/links/actions.ts`.
 */
export function sampleLinksEnabled(env: {
  NODE_ENV?: string;
  [key: string]: string | undefined;
}): boolean {
  return env.NODE_ENV === "development" && env[SAMPLE_LINKS_FLAG] === "1";
}
