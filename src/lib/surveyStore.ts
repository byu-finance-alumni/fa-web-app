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
