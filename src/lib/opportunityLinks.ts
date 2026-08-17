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

/** The role-type options, in the order the alum reads them. */
export const ROLE_TYPE_OPTIONS: readonly { value: LinkRoleType; label: string }[] = [
  { value: "internship", label: "Internship" },
  { value: "full_time", label: "Full-time" },
  { value: "both", label: "Both" },
];

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
