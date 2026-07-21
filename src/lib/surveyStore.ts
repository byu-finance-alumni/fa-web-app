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

// Staff-settable intro message shown at the top of the email + the public
// "confirm your info" landing page.
const MESSAGE_KEY = "fa:needs-surveying:message:v1";

/** The default intro message, used until staff customize it. */
export const DEFAULT_SURVEY_MESSAGE =
  "It's our annual check-in! Please take a moment to confirm your contact and career information so we can keep you in the loop on BYU Finance events, mentoring, and opportunities.";

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

// Which of the alum's current fields to preview INSIDE the email body (a
// read-only "here's what we have on file" block). Keys are `SURVEY_FIELDS` keys.
// Note: putting PII in an email is a FERPA/security tradeoff — keep this to the
// least-sensitive fields you need, and it should pass appsec/FERPA review before
// a real send.
const EMAIL_FIELDS_KEY = "fa:needs-surveying:email-fields:v1";

/** Default fields shown in the email preview until staff customize the set. */
export const DEFAULT_EMAIL_FIELDS: readonly string[] = [
  "employment.current_employer",
  "employment.current_title",
  "employment.current_industry",
  "contact.personal_email",
  "contact.phone",
  "contact.city",
  "contact.state",
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
