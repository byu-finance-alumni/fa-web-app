import { DEFAULT_SURVEY_QUESTIONS, type SurveyQuestion } from "@/types/survey";

/**
 * Frontend-only persistence for the authored "confirm your info" survey.
 *
 * There is no backend survey endpoint, so the edited question set lives in
 * `localStorage`. This stands in for "what Resend would send": edits survive
 * reloads on localhost. All access is SSR-guarded — callers only invoke these
 * from effects/handlers, never during render.
 */
// v2: questions are now column-bound (fieldKey → SURVEY_FIELDS) with no
// free-form types, so any v1 payload is discarded and reseeded from the default.
const STORAGE_KEY = "fa:needs-surveying:questions:v2";

// Staff-settable email copy. The email reads: greeting → intro message →
// "here's what we have on file" → CTA → closing (sign-off). Intro and closing
// are two separate editable blocks so the record preview can sit between them.
const MESSAGE_KEY = "fa:needs-surveying:message:v2";
const CLOSING_KEY = "fa:needs-surveying:closing:v1";

/**
 * The default intro (the copy ABOVE the record preview), used until staff
 * customize it. The greeting ("Hello {first name},") is added automatically, so
 * this starts at the first body paragraph. Authored by the Career Directors.
 */
export const DEFAULT_SURVEY_MESSAGE =
  "Our BYU Finance alumni are one of the greatest strengths of our program. We are working to strengthen our alumni community by staying connected with you throughout your career. To do that, we're reaching out to ensure we have your most current information.\n\nPlease take a moment to review the information below and update or replace any information in our alumni survey that is wrong or missing.";

/**
 * The default closing (the copy BELOW the record preview / call to action),
 * including the sign-off. Used until staff customize it.
 */
export const DEFAULT_SURVEY_CLOSING =
  "If everything above is correct, please confirm that your information is up to date at the bottom of the survey. If anything has changed, please update the applicable questions in the survey. We have also included a few optional questions that will help us better connect with and support our alumni community.\n\nThank you for being an important part of the BYU Finance family. We look forward to staying connected with you in the years ahead!\n\nWarmest regards,\nTanya Harmon & Amy Densley\nBYU Finance Career Directors";

/** A fresh copy of the default seed (never hand out the shared constant). */
export function defaultQuestions(): SurveyQuestion[] {
  return DEFAULT_SURVEY_QUESTIONS.map((q) => ({ ...q }));
}

function isQuestion(value: unknown): value is SurveyQuestion {
  if (typeof value !== "object" || value === null) return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.id === "string" &&
    typeof q.fieldKey === "string" &&
    typeof q.label === "string" &&
    typeof q.required === "boolean"
  );
}

/**
 * Load the saved question set, or the default seed if nothing is stored / the
 * stored value is unusable. Returns the default (not an empty list) on any
 * parse/shape failure so the UI always has something sensible to show.
 */
export function loadQuestions(): SurveyQuestion[] {
  if (typeof window === "undefined") return defaultQuestions();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultQuestions();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isQuestion)) {
      return defaultQuestions();
    }
    return parsed as SurveyQuestion[];
  } catch {
    return defaultQuestions();
  }
}

/** Persist the current question set. No-op during SSR. */
export function saveQuestions(questions: SurveyQuestion[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch {
    // Storage full / disabled (private mode) — edits simply won't persist.
  }
}

/** Clear the saved set so the next load falls back to the default seed. */
export function clearQuestions(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing else to do.
  }
}

/**
 * Load the staff-set intro message, or `DEFAULT_SURVEY_MESSAGE` if nothing is
 * stored / storage is unavailable. Never returns an empty string.
 */
export function loadMessage(): string {
  if (typeof window === "undefined") return DEFAULT_SURVEY_MESSAGE;
  try {
    const raw = window.localStorage.getItem(MESSAGE_KEY);
    if (typeof raw === "string" && raw.trim().length > 0) return raw;
    return DEFAULT_SURVEY_MESSAGE;
  } catch {
    return DEFAULT_SURVEY_MESSAGE;
  }
}

/** Persist the intro message. No-op during SSR. */
export function saveMessage(message: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MESSAGE_KEY, message);
  } catch {
    // Storage full / disabled (private mode) — edits simply won't persist.
  }
}

/**
 * Load the staff-set closing (sign-off) copy, or `DEFAULT_SURVEY_CLOSING` if
 * nothing is stored / storage is unavailable. Never returns an empty string.
 */
export function loadClosing(): string {
  if (typeof window === "undefined") return DEFAULT_SURVEY_CLOSING;
  try {
    const raw = window.localStorage.getItem(CLOSING_KEY);
    if (typeof raw === "string" && raw.trim().length > 0) return raw;
    return DEFAULT_SURVEY_CLOSING;
  } catch {
    return DEFAULT_SURVEY_CLOSING;
  }
}

/** Persist the closing copy. No-op during SSR. */
export function saveClosing(closing: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLOSING_KEY, closing);
  } catch {
    // Storage full / disabled (private mode) — edits simply won't persist.
  }
}

// Which of the alum's current fields to preview INSIDE the email body (a
// read-only "here's what we have on file" block). Keys are `SURVEY_FIELDS` keys.
// Note: putting PII in an email is a FERPA/security tradeoff — keep this to the
// least-sensitive fields you need, and it should pass appsec/FERPA review before
// a real send.
const EMAIL_FIELDS_KEY = "fa:needs-surveying:email-fields:v1";

/** Sentinel "field" for the alum's profile photo (not a `SURVEY_FIELDS` column —
 *  headshots live in a storage bucket, keyed by alumni_id). */
export const HEADSHOT_FIELD_KEY = "profile.headshot";

// Default preview fields, in the order the Career Directors' email lists them
// (employment, then residence, spouse, contact, then grad school + projected
// graduation year). Finance Designations (CFA/CFP/CPA) are Yes/No engagement
// flags, not text, so they're confirmed as survey questions rather than shown
// in this read-only preview.
/** Default fields shown in the email preview until staff customize the set. */
export const DEFAULT_EMAIL_FIELDS: readonly string[] = [
  HEADSHOT_FIELD_KEY,
  "employment.current_employer",
  "employment.current_title",
  "employment.current_industry",
  "employment.current_industry_secondary",
  "employment.current_city",
  "employment.current_state",
  "employment.current_country",
  "contact.city",
  "contact.state",
  "contact.country",
  "profile.spouse_first_name",
  "profile.spouse_last_name",
  "contact.personal_email",
  "contact.work_email",
  "profile.linkedin_url",
  "profile.graduate_degree",
  "profile.graduate_school",
  "profile.graduate_graduation_year",
];

/** Load the staff-selected email-preview field keys (or the default set). */
export function loadEmailFields(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_EMAIL_FIELDS];
  try {
    const raw = window.localStorage.getItem(EMAIL_FIELDS_KEY);
    if (!raw) return [...DEFAULT_EMAIL_FIELDS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((k) => typeof k === "string")) {
      return [...DEFAULT_EMAIL_FIELDS];
    }
    return parsed as string[];
  } catch {
    return [...DEFAULT_EMAIL_FIELDS];
  }
}

/** Persist the email-preview field selection. No-op during SSR. */
export function saveEmailFields(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EMAIL_FIELDS_KEY, JSON.stringify(keys));
  } catch {
    // Storage full / disabled (private mode) — edits simply won't persist.
  }
}
