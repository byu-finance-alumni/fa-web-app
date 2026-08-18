/**
 * The alum-facing opportunity-link form: its entry model, its add/remove rules,
 * and the client-side mirror of the server's field rules (#441).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS AND IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * NONE OF THIS IS A SECURITY CONTROL. `POST /survey/respond/{token}/links` is a
 * PUBLIC write — the signed token is the whole credential — and it validates
 * every field itself, server-side, on the persistence path, via
 * `app/schemas/opportunity_link.validate_opportunity_url` and friends. Anyone
 * can skip this file entirely by posting to the endpoint directly, and the
 * backend is what stops them. The same holds on the way back out: the URL an
 * alum types here is later rendered as an `href` on a staff screen, and that
 * render side runs `safeExternalHref` on the STORED value rather than trusting
 * that it once came through this form.
 *
 * What it IS: the reason an alum with a typo reads "start it with https://"
 * under the box they typed it in, instead of a 422 that lands on the whole
 * batch and tells them nothing about which of their five entries was wrong. The
 * rules are copied from the server deliberately and their ORDER is copied too,
 * so the message shown is the message the server would have produced. When the
 * backend rules change, these must be re-copied — a client rule that is LAXER
 * than the server's produces a confusing 422; one that is STRICTER silently
 * refuses submissions the server would have accepted, which is worse.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT PART OF THE SURVEY FIELD MACHINERY
 * ─────────────────────────────────────────────────────────────────────────────
 * The survey's field pipeline is built on "one survey question maps to exactly
 * one real database column" — `SURVEY_FIELDS`' keys are literally
 * `table.column`, and `sample-survey-parity.test.ts` binds the form list, the
 * email picker and the sample record together on that basis. An opportunity has
 * a url, a company, a location, a role type, a deadline and a description, and
 * an alum can name several: there is no column to map it to. It gets its own
 * table, its own endpoint and its own staff moderation queue, so it must NOT
 * enter `INFO_SECTIONS` / `SURVEY_FIELDS` / `SAMPLE_ALUM`. Adding it there would
 * make the email offer "here's the opportunity link we have on file", which is
 * not a thing that exists.
 */

import { safeExternalHref } from "@/lib/urlSafety";
import type { components } from "@/types/api.gen";
import type { Schema } from "@/types/api";

/** The wire shape for one link. Sent as `{links: [...]}`. */
export type LinkSubmit = components["schemas"]["OpportunitySurveyLinkSubmit"];
export type LinkRoleType = LinkSubmit["role_type"];

/* ------------------------------------------------------------- the caps ---- */

/**
 * Mirrors `app/models/opportunity_link.py` — which mirrors the DB CHECKs, which
 * are the actual persistence bound on a public write. A cap that is wider here
 * than there is a 422 the alum meets after typing; narrower is a submission we
 * refuse that the server would have taken.
 */
export const URL_MAX = 2048;
export const COMPANY_NAME_MAX = 255;
export const CITY_MAX = 100;
export const STATE_MAX = 100;
export const DETAILS_MAX = 2000;

/**
 * Mirrors `MAX_LINKS_PER_SUBMIT`. An abuse bound on an unauthenticated write,
 * not a product opinion: without it one call is an unbounded row-creation
 * primitive. Ten is far above what anyone types in a sitting, so the form
 * enforcing it is a courtesy — the "Add another" button simply stops.
 */
export const MAX_LINKS = 10;

/** Role types in the order the owner listed them (Internship / Full-time / Both). */
export const ROLE_TYPES = ["internship", "full_time", "both"] as const;

/**
 * The ONE place a `role_type` gets a human label — the table, the filters, the
 * staff add form and the alum-facing survey form all read this map, so a
 * relabel happens here and nowhere else.
 *
 * DISPLAY ONLY. The stored values stay the snake_case codes: `both` is the wire
 * value the API contract and the database CHECK constraint both name, and it is
 * spelled "Internship & Full-time" on screen purely because "Both" reads as a
 * riddle out of context. Never let this map leak into a request body.
 */
export const ROLE_TYPE_LABELS: Record<LinkRoleType, string> = {
  internship: "Internship",
  full_time: "Full-time",
  both: "Internship & Full-time",
};

/**
 * The role-type options, in the order the alum reads them. DERIVED from
 * {@link ROLE_TYPE_LABELS} rather than restated, so the alum-facing survey form
 * and the staff screens can never disagree about what a code is called.
 */
export const ROLE_TYPE_OPTIONS: readonly { value: LinkRoleType; label: string }[] =
  ROLE_TYPES.map((value) => ({ value, label: ROLE_TYPE_LABELS[value] }));

/* ------------------------------------------------- character-level rules ---- */

/**
 * Invisible characters, mirroring `_INVISIBLE_CHARS` in
 * `fa-web-api/app/schemas/alumni.py`: zero-width space, the bidi marks,
 * embeddings, overrides and isolates, the word joiner, the Arabic letter mark
 * and the BOM. Control characters (Unicode category Cc) are checked separately
 * with `\p{Cc}` — the Python side folds the two together in one predicate.
 */
const INVISIBLE_CHARS =
  "\u200B\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069\u2060\u061C\uFEFF";

/**
 * The above plus the two joiners (ZWNJ, ZWJ), for values where NO invisible
 * character is ever legitimate. A URL is a machine identifier, not a name: a
 * zero-width character in a hostname exists only to make two different strings
 * look identical to the staff member reading the queue.
 */
const INVISIBLE_CHARS_STRICT = `${INVISIBLE_CHARS}\u200C\u200D`;

const CONTROL_RE = /\p{Cc}/u;

/** Mirrors `_has_control_chars` — control OR (non-strict) invisible. */
function hasControlChars(value: string): boolean {
  return (
    CONTROL_RE.test(value) ||
    [...value].some((ch) => INVISIBLE_CHARS.includes(ch))
  );
}

/** Mirrors `_has_invisible_chars_strict` — control OR any invisible, joiners included. */
function hasInvisibleCharsStrict(value: string): boolean {
  return (
    CONTROL_RE.test(value) ||
    [...value].some((ch) => INVISIBLE_CHARS_STRICT.includes(ch))
  );
}

/** Mirrors `_NAME_DISALLOWED` — meaningful to a SQL/HTML parser, meaningless in a company name. */
const DISALLOWED_CHARS = ";=<>|";

/**
 * The leading characters that turn a spreadsheet cell into a live formula.
 * These rows are attacker-supplied text destined for a staff CSV export, so the
 * same defence the alumni name fields carry applies here.
 */
const FORMULA_LEAD = "=+-@";

/* ---------------------------------------------------------- field rules ---- */

/**
 * One message for every way a URL can be wrong except length, matching the
 * server, which also collapses them into a single "Must be an http(s) URL."
 *
 * Deliberately not itemised. Telling a submitter *which* of the backslash, the
 * zero-width character and the embedded credentials tripped the check is
 * tutoring for the one submitter who is probing, and noise for the ninety-nine
 * who pasted a link with a stray space in it. The example is the useful half.
 */
const URL_MESSAGE =
  "Enter a full web address starting with http:// or https:// — for example https://careers.example.com/jobs/1234.";

/**
 * Validate one opportunity URL. Returns a message, or `null` when acceptable.
 *
 * The checks run in the SERVER'S ORDER, and the pre-parse ones stay before the
 * parse for the reason its docstring gives: whatever this decides, the thing
 * that eventually follows the link is a browser, and Python's `urlsplit` and the
 * browser's WHATWG parser disagree about backslashes and about raw tab/CR/LF.
 * A value that means two different things to two parsers is refused outright
 * rather than reasoned about. (Here, both parsers ARE WHATWG — `safeExternalHref`
 * uses `new URL` — so this half is about matching the server's verdict, not
 * about closing a gap on this side.)
 */
export function validateOpportunityUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "A link is required.";
  if (v.length > URL_MAX) return `Must be ${URL_MAX} characters or fewer.`;
  if (hasInvisibleCharsStrict(v)) return URL_MESSAGE;
  // Any whitespace at all. A real URL percent-encodes it; a raw space is either
  // a mistake or an attempt to shift where a parser thinks the URL ends.
  if (/\s/.test(v)) return URL_MESSAGE;
  // The RFC-3986-vs-WHATWG backslash differential, case-insensitive because %5C
  // and %5c are the same byte once decoded.
  if (v.includes("\\") || v.toLowerCase().includes("%5c")) return URL_MESSAGE;

  // Scheme gating, via the shared render-side guard so "what may be an href" has
  // one definition in this repo. It parses rather than regex-matching, which is
  // what collapses `java\nscript:` and friends before the scheme is read.
  const safe = safeExternalHref(v);
  if (safe === null) return URL_MESSAGE;

  const url = new URL(safe);
  // `https://acme.example@evil.example/jobs` resolves at evil.example while
  // READING as acme.example to a human scanning the queue. No job posting has a
  // userinfo section, so refusing them costs nothing.
  if (url.username || url.password) return URL_MESSAGE;
  const host = url.hostname.toLowerCase();
  // A bare label ("localhost", "intranet") is never an employer's careers page,
  // and the hostname is the only part of this value a reviewer can sanity-check.
  if (!host || !host.replace(/^\.+|\.+$/g, "").includes(".")) return URL_MESSAGE;
  return null;
}

/**
 * The free-text rule for company / city / state, mirroring
 * `_validate_short_text`. Returns a message, or `null`.
 *
 * `required` is the caller's call because the same rule serves a mandatory
 * company name and an optional city.
 */
export function validateShortText(
  raw: string,
  opts: { field: string; max: number; required?: boolean },
): string | null {
  const v = raw.trim();
  if (!v) return opts.required ? `${opts.field} is required.` : null;
  if (v.length > opts.max) return `Must be ${opts.max} characters or fewer.`;
  if (hasControlChars(v))
    return `${opts.field} contains characters that aren't allowed.`;
  if ([...v].some((ch) => DISALLOWED_CHARS.includes(ch)))
    return `${opts.field} can't contain ; = < > or |.`;
  if (FORMULA_LEAD.includes(v[0]))
    return `${opts.field} can't start with =, +, - or @.`;
  return null;
}

/**
 * The rule for the free-text details blob, mirroring `validate_details`.
 *
 * Looser on characters than {@link validateShortText} on purpose: this is a
 * description of a job, so `>=` in a salary line and `<` in a date range are
 * ordinary English. Newlines are exempted from the control-character check
 * because a multi-line description is the expected shape.
 */
export function validateDetails(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.length > DETAILS_MAX) return `Must be ${DETAILS_MAX} characters or fewer.`;
  if (hasControlChars(v.replace(/[\n\r]/g, "")))
    return "Details contain characters that aren't allowed.";
  if (FORMULA_LEAD.includes(v[0]))
    return "Details can't start with =, +, - or @.";
  return null;
}

/* ----------------------------------------------------------- the entry ----- */

/**
 * One row of the form. `id` is a client-only React key — it is never sent, and
 * nothing server-side ever sees it. Every value is a string because every
 * control is a text input, a select or a date input; the mapping to the wire
 * shape (nulls for blanks) happens once, in {@link linksToSubmit}.
 */
export type LinkEntry = {
  id: string;
  isOwnCompany: boolean;
  companyName: string;
  url: string;
  city: string;
  state: string;
  /** `""` until the alum picks one — the server requires a real value. */
  roleType: LinkRoleType | "";
  /** `yyyy-mm-dd` from a native date input, or `""`. */
  deadline: string;
  details: string;
};

/** Which fields of an entry can carry an error message. */
export type LinkEntryErrors = Partial<
  Record<"companyName" | "url" | "city" | "state" | "roleType" | "details", string>
>;

let entryCounter = 0;

/** A blank entry with a fresh key. */
export function emptyLinkEntry(): LinkEntry {
  entryCounter += 1;
  return {
    id: `link-${entryCounter}`,
    isOwnCompany: false,
    companyName: "",
    url: "",
    city: "",
    state: "",
    roleType: "",
    deadline: "",
    details: "",
  };
}

/**
 * Whether the alum has put nothing at all in this entry.
 *
 * The form starts with one blank row so the section isn't an empty page with a
 * button on it, and most alumni will never fill it in. A blank row is DROPPED
 * rather than validated or submitted — otherwise simply opening the section and
 * backing out would block the whole survey behind "a link is required".
 */
export function isBlankLinkEntry(entry: LinkEntry): boolean {
  return (
    !entry.isOwnCompany &&
    !entry.companyName.trim() &&
    !entry.url.trim() &&
    !entry.city.trim() &&
    !entry.state.trim() &&
    entry.roleType === "" &&
    !entry.deadline &&
    !entry.details.trim()
  );
}

/** Append a blank entry, up to {@link MAX_LINKS}. At the cap, returns the input unchanged. */
export function addLinkEntry(entries: readonly LinkEntry[]): LinkEntry[] {
  if (entries.length >= MAX_LINKS) return [...entries];
  return [...entries, emptyLinkEntry()];
}

/**
 * Drop one entry by id.
 *
 * Removing the last remaining entry leaves ONE blank entry rather than an empty
 * list: "Remove" on a half-typed row means "start this one over", and an empty
 * section with no row and no way back into one is a dead end on a phone. A blank
 * entry submits nothing (see {@link isBlankLinkEntry}), so this costs nothing.
 */
export function removeLinkEntry(
  entries: readonly LinkEntry[],
  id: string,
): LinkEntry[] {
  const kept = entries.filter((e) => e.id !== id);
  return kept.length > 0 ? kept : [emptyLinkEntry()];
}

/** Replace one field on one entry, leaving every other entry identical. */
export function updateLinkEntry(
  entries: readonly LinkEntry[],
  id: string,
  patch: Partial<Omit<LinkEntry, "id">>,
): LinkEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
}

/* -------------------------------------------------------- validation ------- */

/**
 * Every complaint about one entry, keyed by field. `{}` means "nothing to say" —
 * which is also the answer for a blank entry, because a blank entry is dropped.
 *
 * The company rule is the interesting one and mirrors the server's
 * `_company_identity` model validator: "this is my company" means "look the name
 * up from my employment record", so a typed name ALONGSIDE it is ambiguous
 * rather than redundant. The form prevents that by hiding the input when the box
 * is ticked, and `linksToSubmit` drops the value regardless — but the rule is
 * restated here so the two can't drift into disagreeing.
 */
export function validateLinkEntry(entry: LinkEntry): LinkEntryErrors {
  if (isBlankLinkEntry(entry)) return {};
  const errors: LinkEntryErrors = {};

  if (!entry.isOwnCompany) {
    const msg = validateShortText(entry.companyName, {
      field: "Company name",
      max: COMPANY_NAME_MAX,
      required: true,
    });
    if (msg) errors.companyName = msg;
  }

  const urlMsg = validateOpportunityUrl(entry.url);
  if (urlMsg) errors.url = urlMsg;

  const cityMsg = validateShortText(entry.city, { field: "City", max: CITY_MAX });
  if (cityMsg) errors.city = cityMsg;

  const stateMsg = validateShortText(entry.state, {
    field: "State",
    max: STATE_MAX,
  });
  if (stateMsg) errors.state = stateMsg;

  if (entry.roleType === "")
    errors.roleType = "Choose whether this is an internship, full-time, or both.";

  const detailsMsg = validateDetails(entry.details);
  if (detailsMsg) errors.details = detailsMsg;

  return errors;
}

/**
 * Errors for a whole list, keyed by entry id. Entries with nothing wrong (and
 * blank entries) are absent, so `Object.keys(...).length === 0` is "the batch is
 * ready to send".
 */
export function validateLinkEntries(
  entries: readonly LinkEntry[],
): Record<string, LinkEntryErrors> {
  const all: Record<string, LinkEntryErrors> = {};
  for (const entry of entries) {
    const errors = validateLinkEntry(entry);
    if (Object.keys(errors).length > 0) all[entry.id] = errors;
  }
  return all;
}

/* ------------------------------------------------------------ the wire ----- */

const trimmedOrNull = (value: string): string | null => value.trim() || null;

/**
 * The entries that are actually worth sending, in wire shape. Blank entries are
 * dropped; an empty result means "don't call the endpoint at all" (the request
 * body requires at least one link, so posting an empty batch would be a 422 for
 * the alum who never touched the section).
 *
 * `is_own_company` wins over a typed name, matching the server's CHECK: the name
 * is resolved from the employment record at read time so it follows a job
 * change, and persisting a typed one alongside the flag would leave two answers
 * to one question.
 */
export function linksToSubmit(entries: readonly LinkEntry[]): LinkSubmit[] {
  return entries
    .filter((e) => !isBlankLinkEntry(e))
    .map((e) => ({
      is_own_company: e.isOwnCompany,
      company_name: e.isOwnCompany ? null : trimmedOrNull(e.companyName),
      url: e.url.trim(),
      location_city: trimmedOrNull(e.city),
      location_state: trimmedOrNull(e.state),
      // Never reached with `""` — `validateLinkEntry` gates on it and the submit
      // path validates before mapping. The cast keeps the wire type honest
      // rather than widening it to include a value the API would reject.
      role_type: (e.roleType || "internship") as LinkRoleType,
      application_deadline: e.deadline || null,
      details: trimmedOrNull(e.details),
    }));
}

/* --------------------------------------------------------- failure modes --- */

/**
 * What the alum reads when the links call fails, by HTTP status.
 *
 * Every one of these names what to DO, because the alum is at their keyboard and
 * can act — which is exactly why this endpoint 422s a bad batch instead of
 * silently dropping fields the way the survey field whitelist does. The batch is
 * all-or-nothing server-side, so none of these mean "some of your links landed".
 */
export function linkSubmitErrorMessage(status: number | null): string {
  switch (status) {
    case 404:
    case 410:
      return "This survey link has expired, so we couldn't save your opportunities. Your other updates were received. Please ask the BYU Finance team for a fresh link.";
    case 429:
      return "We've had too many submissions from this link in a short time. Please wait a few minutes and press submit again — nothing was sent twice.";
    case 400:
    case 422:
      return "One of your opportunities couldn't be saved — please check the link and the details, then press submit again. None of them were saved yet.";
    case 413:
      return "Your opportunity details are too long to save. Please shorten them and press submit again.";
    default:
      return "We couldn't save your opportunities just now. Your other updates were received — please press submit again to retry just the opportunities.";
  }
}

/* ================================================================== *
 * STAFF-SIDE LINKS TAB: filter state, display rules and the add form.
 *
 * Merged in from the Links-tab workstream. It deliberately reuses the
 * validation above rather than restating it: the alum-facing form and the
 * staff add form must accept exactly the same values, or staff could enter
 * a link an alum could not, and the URL cap must track the backend column
 * (varchar(2048)) rather than a guessed 500.
 * ================================================================== */

export type OpportunityLink = Schema<"OpportunityLinkRead">;
export type OpportunityLinkCreate = Schema<"OpportunityLinkCreate">;
export type OpportunityLinkPage = Schema<"OpportunityLinkPage">;

export type LinkStatus = OpportunityLink["status"];

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

/* `ROLE_TYPES` / `ROLE_TYPE_LABELS` are defined once, near the top of this file
   with the rest of the shared vocabulary. */

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
 * The staff add form's two steps
 * ------------------------------------------------------------------ */

/**
 * The Add-link steps, in order. Same shape as `EVENT_STEPS` in
 * `@/lib/eventWizard` so the two wizards can render the same "Step n of N ·
 * Label" meter.
 */
export const ADD_LINK_STEPS = ["Who this is from", "The opportunity"] as const;

export type AddLinkStep = (typeof ADD_LINK_STEPS)[number];

/** Index of the last step — the only one that may submit. */
export const ADD_LINK_LAST_STEP = ADD_LINK_STEPS.length - 1;

/**
 * Which fields each step owns. The mapping is the reason a validation message
 * can never land on a step the reader is not looking at: step 1 is only the
 * attribution, so a URL complaint belongs to step 2 and vice versa.
 */
export const ADD_LINK_STEP_FIELDS: readonly (readonly (keyof AddLinkErrors)[])[] = [
  ["alumniId"],
  ["companyName", "url"],
];

/**
 * The errors for ONE step, filtered out of {@link validateAddLink} rather than
 * re-derived. Anything else would be a second copy of the rules that could
 * disagree with the one the submit path runs.
 *
 * An out-of-range step yields `{}` — there is nothing to complain about on a
 * step that does not exist.
 */
export function validateAddLinkStep(
  v: AddLinkFormValues,
  step: number,
): AddLinkErrors {
  const fields = ADD_LINK_STEP_FIELDS[step];
  if (!fields) return {};
  const all = validateAddLink(v);
  const errors: AddLinkErrors = {};
  for (const field of fields) {
    const message = all[field];
    if (message) errors[field] = message;
  }
  return errors;
}

/**
 * The furthest step these values may be shown on.
 *
 * Step 2 asks about an opportunity "from" someone, so it is meaningless — and
 * unsubmittable — until an alumnus is chosen. Rather than trusting the Next
 * button to be the only way forward, the form clamps its own step through this,
 * so a stale step index (a back/forward navigation, a re-render after the
 * chosen alumnus is cleared) can't strand the user on step 2 with no
 * attribution.
 */
export function maxReachableAddLinkStep(v: AddLinkFormValues): number {
  return v.alumniId === null ? 0 : ADD_LINK_LAST_STEP;
}