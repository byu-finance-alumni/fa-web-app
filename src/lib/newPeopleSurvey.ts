/**
 * The "new people" survey's pure logic (api#661): one shared link for alumni and
 * professionals who are not in the database yet.
 *
 * Everything here is free of React and of the network so it can be tested
 * directly. The page (`app/survey/new/[key]/page.tsx`) owns the fetches and the
 * screens (`components/survey/new-people-screens.tsx`) own the markup.
 *
 * The QUESTIONS are not redefined here. Every field is looked up by key in the
 * live survey's own lists (`INFO_SECTIONS`, `ENGAGEMENT_SECTION`), so a label,
 * kind or rule changed there changes here too. The only fields this file
 * defines are the three the existing survey has no use for: `new.graduation_year`,
 * `new.byu_degree` and the optional `new.byu_id`, asked of the BYU-alum path only.
 *
 * WHICH FIELDS ARE REQUIRED is not decided here either. It comes from the
 * server's `required_fields[kind]` (ANY-OF groups) on every load, and nothing in
 * this file hard-codes it.
 */
import {
  ENGAGEMENT_SECTION,
  INFO_SECTIONS,
  validateSurveyField,
  type EditField,
  type Fields,
} from "@/components/survey/survey-screens";
import { commentsToSubmit } from "@/lib/surveyWaysToHelp";
import type {
  NewPeopleRequiredFields,
  NewPersonKind,
  NewPersonSubmitRequest,
} from "@/types/new-people-survey";

/** The career directors' introduction, verbatim from api#661 (2026-11-10). */
export const NEW_PEOPLE_INTRO_PARAGRAPHS: readonly string[] = [
  "Whether you're a BYU Finance alum or a professional who stays engaged with our students, your experience and willingness to help are a valued part of our community.",
  "We're updating our records so we can stay connected with you throughout your career. Please take a moment to complete this survey with your current career and contact information. A few optional questions will also help us understand how you'd like to stay involved and support our students.",
  "Thank you for being part of the BYU Finance community. We look forward to staying connected with you in the years ahead!",
];

/** The sign-off, one line each, kept as the email had it. */
export const NEW_PEOPLE_INTRO_SIGNOFF: readonly string[] = [
  "Warmest regards,",
  "Tanya Harmon & Amy Densley",
  "BYU Finance Career Directors",
];

/** What a closed (wrong, reissued or switched-off) link says. */
export const NEW_PEOPLE_LINK_CLOSED = "This survey link is closed.";

/** The two answers to the first question, in the order they are shown. */
export const NEW_PERSON_KIND_OPTIONS: readonly { kind: NewPersonKind; label: string }[] = [
  { kind: "alum", label: "BYU Alumni Professional" },
  { kind: "friend", label: "Non-BYU Alumni Professional" },
];

export const NEW_GRADUATION_YEAR_KEY = "new.graduation_year";
export const NEW_BYU_DEGREE_KEY = "new.byu_degree";
/** Optional, BYU path only. Sent digits-only; the backend validates again. */
export const NEW_BYU_ID_KEY = "new.byu_id";

export const EMPLOYMENT_COUNTRY_KEY = "employment.current_country";
export const EMPLOYMENT_STATE_KEY = "employment.current_state";

/** The questions only this survey asks. */
export const NEW_EDUCATION_FIELDS: EditField[] = [
  {
    key: NEW_GRADUATION_YEAR_KEY,
    label: "BYU graduation year",
    kind: "text",
    placeholder: "e.g. 2008",
  },
  {
    key: NEW_BYU_DEGREE_KEY,
    label: "BYU degree",
    kind: "text",
    placeholder: "e.g. BS Finance, MBA",
  },
  {
    key: NEW_BYU_ID_KEY,
    label: "BYU ID (optional)",
    kind: "text",
    helpText: "9 digits, if you know it.",
  },
];

export type NewPeoplePageId =
  | "contact"
  | "education"
  | "employment"
  | "engagement"
  | "comments";

export type NewPeoplePage = {
  id: NewPeoplePageId;
  title: string;
  blurb: string;
  /** Empty for the comments page, whose box is not a field. */
  fields: EditField[];
};

const ALL_SURVEY_FIELDS: EditField[] = [
  ...INFO_SECTIONS.flatMap((s) => s.fields),
  ...ENGAGEMENT_SECTION.fields,
];

/** A field from the live survey by key. Throws so a renamed key fails tests loudly. */
function surveyField(key: string): EditField {
  const f = ALL_SURVEY_FIELDS.find((x) => x.key === key);
  if (!f) throw new Error(`new-people survey: no survey field "${key}"`);
  // A copy without `required`: the live survey's own markers (it marks the
  // permanent email) do not apply here. Requiredness comes from the server.
  const copy = { ...f };
  delete copy.required;
  return copy;
}

/**
 * Name and contact: the Name, Contact and Residence groups of the live survey's
 * Personal section. Marriage and personal details are left out on purpose: the
 * page is "name and contact information" in the career directors' email.
 */
const CONTACT_KEYS = [
  "profile.first_name",
  "profile.middle_name",
  "profile.last_name",
  "profile.preferred_first_name",
  "contact.personal_email",
  "contact.work_email",
  "contact.phone",
  "contact.city",
  "contact.state",
  "contact.country",
];

const EMPLOYMENT_SECTION = INFO_SECTIONS.find((s) => s.id === "employment");

const PAGES: Record<NewPeoplePageId, NewPeoplePage> = {
  contact: {
    id: "contact",
    title: "Name & contact",
    blurb: "Who you are and how we can reach you.",
    fields: CONTACT_KEYS.map(surveyField),
  },
  education: {
    id: "education",
    title: "BYU education",
    blurb: "When you graduated from BYU and what you studied.",
    fields: NEW_EDUCATION_FIELDS,
  },
  employment: {
    id: "employment",
    title: "Employment",
    blurb: "Where you work now.",
    fields: (EMPLOYMENT_SECTION?.fields ?? []).map((f) => surveyField(f.key)),
  },
  engagement: {
    id: "engagement",
    title: "Ways to get involved",
    blurb:
      "Say yes to anything you'd be open to. Nothing here commits you to a date. Someone from the Finance team gets in touch first.",
    fields: ENGAGEMENT_SECTION.fields.map((f) => surveyField(f.key)),
  },
  comments: {
    id: "comments",
    title: "Anything else",
    blurb: "",
    fields: [],
  },
};

/** The pages, in order, for one kind. Only BYU alumni get the education page. */
export function pageSequence(kind: NewPersonKind): NewPeoplePage[] {
  const ids: NewPeoplePageId[] =
    kind === "alum"
      ? ["contact", "education", "employment", "engagement", "comments"]
      : ["contact", "employment", "engagement", "comments"];
  return ids.map((id) => PAGES[id]);
}

/** Every field key this kind is shown, and therefore may send. */
export function fieldKeysFor(kind: NewPersonKind): string[] {
  return pageSequence(kind).flatMap((p) => p.fields.map((f) => f.key));
}

/** The server's ANY-OF groups for a kind, minus empty ones. */
export function requiredGroupsFor(
  required: NewPeopleRequiredFields | null | undefined,
  kind: NewPersonKind,
): string[][] {
  return (required?.[kind] ?? []).filter((g) => Array.isArray(g) && g.length > 0);
}

/** Every key that appears in any required group: these get the "*" marker. */
export function requiredKeySet(groups: string[][]): Set<string> {
  return new Set(groups.flat());
}

/**
 * The page's fields with `required` set from the server's groups, and a hint on
 * the fields of a multi-key group so "either one" is visible before Next.
 */
export function withRequiredMarkers(
  fields: EditField[],
  groups: string[][],
): EditField[] {
  const required = requiredKeySet(groups);
  return fields.map((f) => {
    if (!required.has(f.key)) return f;
    const group = groups.find((g) => g.includes(f.key) && g.length > 1);
    const hint = group ? `Fill in at least one of: ${labelsFor(group).join(", ")}.` : undefined;
    return {
      ...f,
      required: true,
      helpText: hint ? (f.helpText ? `${f.helpText} ${hint}` : hint) : f.helpText,
    };
  });
}

function labelFor(key: string): string {
  const all = [...ALL_SURVEY_FIELDS, ...NEW_EDUCATION_FIELDS];
  return all.find((f) => f.key === key)?.label ?? key;
}

/**
 * Whether a country answer is the United States, per the server's
 * `state_required_countries` (lower-case). Trimmed and case-insensitive; the
 * list itself is never hard-coded here.
 */
export function isStateRequiredCountry(
  country: string | null | undefined,
  stateRequiredCountries: readonly string[] | null | undefined,
): boolean {
  const c = (country ?? "").trim().toLowerCase();
  if (!c) return false;
  return (stateRequiredCountries ?? []).some((x) => x.trim().toLowerCase() === c);
}

/**
 * The server's groups plus `[employment.current_state]` when the chosen
 * employment country is the US. Feeds both the "*" markers and Next/Submit
 * validation, so the State question turns required the moment the country does.
 */
export function effectiveRequiredGroups(
  groups: string[][],
  values: Fields,
  stateRequiredCountries: readonly string[] | null | undefined,
): string[][] {
  if (!isStateRequiredCountry(values[EMPLOYMENT_COUNTRY_KEY], stateRequiredCountries)) {
    return groups;
  }
  if (groups.some((g) => g.length === 1 && g[0] === EMPLOYMENT_STATE_KEY)) return groups;
  return [...groups, [EMPLOYMENT_STATE_KEY]];
}

/** A BYU ID with spaces and dashes removed. */
export function normalizeByuId(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export const BYU_ID_FORMAT_MESSAGE = "BYU ID must be 9 digits.";

/** Blank is "not given"; otherwise exactly 9 digits once spaces and dashes go. */
export function validateByuId(value: string): string | null {
  const v = normalizeByuId(value);
  if (!v) return null;
  return /^\d{9}$/.test(v) ? null : BYU_ID_FORMAT_MESSAGE;
}

function labelsFor(keys: string[]): string[] {
  return keys.map(labelFor);
}

const isFilled = (values: Fields, key: string) => (values[key] ?? "").trim() !== "";

/**
 * Inline errors for one page, keyed by field key.
 *
 * Required: every ANY-OF group whose keys are on THIS page and none of whose
 * keys is filled. A group is checked on the first page (in this kind's order)
 * that shows any of its keys, so a group can never block two pages. The message
 * lands on the group's first field on the page.
 *
 * A group with no key on any page this kind sees cannot be filled here at all;
 * it is left to the server, whose 422 the submit step shows.
 *
 * Then the live survey's own per-field rules (LinkedIn, the controlled
 * vocabularies) on every non-blank value. Nothing is ever on file for a new
 * person, so the on-file exemption never applies.
 */
export function validatePage(
  page: NewPeoplePage,
  kind: NewPersonKind,
  groups: string[][],
  values: Fields,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const pages = pageSequence(kind);
  const pageKeys = new Set(page.fields.map((f) => f.key));

  for (const group of groups) {
    const owner = pages.find((p) => p.fields.some((f) => group.includes(f.key)));
    if (!owner || owner.id !== page.id) continue;
    if (group.some((k) => isFilled(values, k))) continue;
    const firstOnPage = page.fields.find((f) => group.includes(f.key));
    if (!firstOnPage) continue;
    const onPage = group.filter((k) => pageKeys.has(k));
    errors[firstOnPage.key] =
      onPage.length > 1
        ? `Please fill in ${labelsFor(onPage).join(" or ")}.`
        : `Please fill in ${firstOnPage.label}.`;
  }

  for (const f of page.fields) {
    if (errors[f.key]) continue;
    const value = values[f.key] ?? "";
    if (!value.trim()) continue;
    const msg =
      f.key === NEW_GRADUATION_YEAR_KEY
        ? validateGraduationYear(value)
        : f.key === NEW_BYU_ID_KEY
          ? validateByuId(value)
          : validateSurveyField(f, value, null);
    if (msg) errors[f.key] = msg;
  }
  return errors;
}

/** A four-digit year. A courtesy only; the backend validates again. */
export function validateGraduationYear(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{4}$/.test(v)) return "Please enter a four-digit year, for example 2008.";
  return null;
}

/**
 * The POST body. Only keys this kind is shown, only non-blank values, trimmed:
 * every field starts blank, so a blank is "not answered", and a friend who once
 * opened the alum path never sends its education answers.
 */
export function buildSubmitBody({
  kind,
  values,
  comments,
  fillSeconds,
  website,
}: {
  kind: NewPersonKind;
  values: Fields;
  comments: string;
  fillSeconds: number | null | undefined;
  website: string;
}): NewPersonSubmitRequest {
  const fields: Record<string, string> = {};
  for (const key of fieldKeysFor(kind)) {
    const raw = (values[key] ?? "").trim();
    const v = key === NEW_BYU_ID_KEY ? normalizeByuId(raw) : raw;
    if (v) fields[key] = v;
  }
  return {
    kind,
    fields,
    comments: commentsToSubmit(comments),
    fill_seconds:
      typeof fillSeconds === "number" && Number.isFinite(fillSeconds) && fillSeconds >= 0
        ? Math.round(fillSeconds)
        : null,
    website,
  };
}

/** The public link staff copy: `{origin}/survey/new/{key}`. */
export function newPeopleSurveyUrl(origin: string, key: string): string {
  return `${origin.replace(/\/+$/, "")}/survey/new/${encodeURIComponent(key)}`;
}

/**
 * Field keys named anywhere in a 422 body, in page order. The envelope's exact
 * shape is the backend's, so this looks for any string that is one of our keys
 * rather than assuming where the list sits.
 */
export function missingKeysFromError(body: unknown, kind: NewPersonKind): string[] {
  const known = fieldKeysFor(kind);
  const found = new Set<string>();
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      for (const k of known) if (keyPattern(k).test(v)) found.add(k);
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(body);
  return known.filter((k) => found.has(k));
}

// The key as a whole token, so `employment.current_industry` does not match
// inside `employment.current_industry_secondary`.
function keyPattern(key: string): RegExp {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w.])${escaped}(?![\\w.])`);
}

/** The message under the Submit button for a failed POST. */
export function submitErrorMessage(
  status: number | null,
  body: unknown,
  kind: NewPersonKind,
): string {
  switch (status) {
    case 422: {
      const named = missingKeysFromError(body, kind);
      // A BYU ID is never required, so its 422 is a format complaint, not "fill in".
      const missing = named.filter((k) => k !== NEW_BYU_ID_KEY);
      if (named.includes(NEW_BYU_ID_KEY) && missing.length === 0) {
        return `${BYU_ID_FORMAT_MESSAGE} Use Back to return to that question.`;
      }
      if (missing.length > 0) {
        return `Please fill in: ${labelsFor(missing).join(", ")}. Use Back to return to those questions.`;
      }
      const serverMsg = errorMessageOf(body);
      return serverMsg
        ? `We couldn't save your answers: ${serverMsg}`
        : "Some answers couldn't be saved. Please check them and press Submit again.";
    }
    case 413:
      return "Your answers are too long to save. Please shorten them (the comment box especially) and press Submit again.";
    case 429:
      return "We've had too many submissions from this connection in a short time. Please wait a few minutes and press Submit again.";
    case 404:
      return NEW_PEOPLE_LINK_CLOSED;
    default:
      return "Something went wrong sending your answers. Please press Submit again.";
  }
}

/** `error.message` from the standard envelope, when there is one. */
export function errorMessageOf(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: unknown }).error;
    if (err && typeof err === "object" && "message" in err) {
      const m = (err as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) return m.trim();
    }
  }
  return null;
}

/** The page holding a field key, for jumping back to it after a 422. */
export function pageIndexOfKey(kind: NewPersonKind, key: string): number {
  return pageSequence(kind).findIndex((p) => p.fields.some((f) => f.key === key));
}
