import type { SurveyFieldKey } from "@/types/survey";

/**
 * A single mock alum used ONLY to pre-fill the survey preview so staff can see
 * what an alum would receive with real-looking data. Not persisted, not sent —
 * purely illustrative. Keyed by the confirm-field `fieldKey`s in
 * `src/types/survey.ts`.
 */
export const SAMPLE_ALUM: Record<SurveyFieldKey, string> = {
  email: "jordan.avery@gmail.com",
  phone: "(801) 555-0142",
  linkedin_url: "linkedin.com/in/jordan-avery",
  current_city: "Salt Lake City",
  current_state: "UT",
  current_employer: "Goldman Sachs",
  current_title: "Investment Banking Analyst",
};

/** Display name for the sample alum, used in the preview intro line. */
export const SAMPLE_ALUM_NAME = "Jordan Avery";
