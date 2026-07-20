/**
 * "Confirm your info" re-survey question model (frontend-only, #160 follow-up).
 *
 * These types describe the exact survey content that the biennial re-survey
 * campaign would email to alumni via Resend to have them verify/update their
 * profile. There is NO backend survey endpoint yet — the question set is
 * authored and previewed entirely in the browser and persisted to
 * `localStorage` (see `src/lib/surveyStore.ts`). This is the authoring +
 * preview surface only; nothing here sends email or calls an API.
 */

/**
 * The kind of question, which decides the control rendered in the preview:
 * - `confirm-field` — "is this still current?" for a specific alumni field
 *   (named by `fieldKey`); the preview pre-fills it from the alum's record.
 * - `short-text` — single-line free text.
 * - `long-text` — multi-line free text.
 * - `single-choice` — pick one of `options`.
 * - `yes-no` — a simple yes/no toggle.
 */
export type SurveyQuestionType =
  | "confirm-field"
  | "short-text"
  | "long-text"
  | "single-choice"
  | "yes-no";

/**
 * Which alumni field a `confirm-field` question asks the alum to confirm. These
 * are real column names on the backend alumni model (see
 * `src/types/api.gen.ts` `AlumniListItem` / `AlumniRead`) so the preview can
 * pre-fill the current value.
 */
export type SurveyFieldKey =
  | "email"
  | "phone"
  | "linkedin_url"
  | "current_city"
  | "current_state"
  | "current_employer"
  | "current_title";

/** A single authored survey question. */
export interface SurveyQuestion {
  /** Stable, unique identifier (used as the React key and for reordering). */
  id: string;
  type: SurveyQuestionType;
  /** The question text the alum reads. */
  label: string;
  /** Optional helper text shown under the label. */
  helpText?: string;
  required: boolean;
  /** For `confirm-field`: which alumni field this confirms (drives prefill). */
  fieldKey?: SurveyFieldKey;
  /** For `single-choice`: the selectable options. */
  options?: string[];
}

/** Human-readable labels for each question type (used in the editor dropdown). */
export const SURVEY_QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  "confirm-field": "Confirm a field",
  "short-text": "Short text",
  "long-text": "Long text",
  "single-choice": "Single choice",
  "yes-no": "Yes / No",
};

/** Friendly labels for each confirmable field (used in the editor + preview). */
export const SURVEY_FIELD_LABELS: Record<SurveyFieldKey, string> = {
  email: "Email",
  phone: "Phone",
  linkedin_url: "LinkedIn URL",
  current_city: "City",
  current_state: "State",
  current_employer: "Current employer",
  current_title: "Current title",
};

/**
 * The default "confirm your info" question set. Seeded on first load and
 * restored by "Reset to default". Covers the core contact/career fields the
 * re-survey exists to keep fresh, plus one open-ended catch-all.
 */
export const DEFAULT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "confirm-email",
    type: "confirm-field",
    fieldKey: "email",
    label: "Is this still your best email?",
    helpText: "We'll use this to reach you about events and opportunities.",
    required: true,
  },
  {
    id: "confirm-phone",
    type: "confirm-field",
    fieldKey: "phone",
    label: "Is this still your current phone number?",
    required: false,
  },
  {
    id: "confirm-linkedin",
    type: "confirm-field",
    fieldKey: "linkedin_url",
    label: "Is this your current LinkedIn profile?",
    required: false,
  },
  {
    id: "confirm-city",
    type: "confirm-field",
    fieldKey: "current_city",
    label: "Is this the city where you currently live?",
    required: false,
  },
  {
    id: "confirm-state",
    type: "confirm-field",
    fieldKey: "current_state",
    label: "Is this your current state?",
    required: false,
  },
  {
    id: "confirm-employer",
    type: "confirm-field",
    fieldKey: "current_employer",
    label: "Is this still your current employer?",
    required: true,
  },
  {
    id: "confirm-title",
    type: "confirm-field",
    fieldKey: "current_title",
    label: "Is this still your current job title?",
    required: false,
  },
  {
    id: "anything-else",
    type: "long-text",
    label: "Anything else we should know?",
    helpText: "New role, promotion, relocation, or anything you'd like to share.",
    required: false,
  },
];
