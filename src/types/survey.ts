/**
 * "Confirm / update your info" annual re-survey model (frontend-only, #160
 * follow-up).
 *
 * Hard rule (per product): EVERY survey question maps to exactly one real
 * database column — nothing free-form, so every answer has a home in the DB and
 * can be applied to the record. A question therefore does not carry its own
 * "type"; it references a column in `SURVEY_FIELDS` (the whitelist below) and the
 * control shown to the alum is derived from that column's `kind`:
 *   - `text`    → an input pre-filled with the value we have on file.
 *   - `boolean` → a Yes/No choice (used for the "are you willing to…" engagement
 *                 flags that drive tags, hiring flags, designations, and the Pay
 *                 It Forward donor flag).
 *
 * These columns back the survey EMAIL's "here's what we have on file" preview
 * block (see `src/lib/surveyStore.ts`). The survey FORM itself is defined by
 * `components/survey/survey-screens` — the authored-question model that used to
 * live here was removed in #574 because nothing read it, so the staff preview
 * had drifted from the form alumni were actually sent.
 */

/** External Pay It Forward donation page (shown on the giving question). */
export const PAY_IT_FORWARD_URL =
  "https://give.churchofjesuschrist.org/campaigns/81293/donations/new";

/** How the field renders for the alum, derived from the column's data type. */
export type SurveyControlKind = "text" | "boolean";

/** Which section a surveyable column belongs to (groups the column picker). */
export type SurveyFieldGroup =
  | "contact"
  | "profile"
  | "employment"
  | "engagement"
  | "giving";

/**
 * One column that a survey question may target. `table`/`column` name the real
 * Postgres location (see `database/schema.sql`) so a response maps straight onto
 * the record; `key` is the stable `table.column` identifier stored on questions.
 */
export interface SurveyField {
  key: string;
  table: string;
  column: string;
  label: string;
  group: SurveyFieldGroup;
  kind: SurveyControlKind;
  /** Giving field only: the external donate URL surfaced in the preview. */
  donateUrl?: string;
}

/** Friendly labels for each group (used to section the editor's column picker). */
export const SURVEY_GROUP_LABELS: Record<SurveyFieldGroup, string> = {
  contact: "Contact info (alumni_contact_info)",
  profile: "Profile (alumni)",
  employment: "Employment (current_employment)",
  engagement: "Willingness & engagement (alumni_program_engagement)",
  giving: "Giving (alumni_program_engagement)",
};

/**
 * The whitelist of columns a survey may update — the "update every year" fields
 * plus the willingness/hiring/donation flags. Every question must reference one
 * of these `key`s, so nothing is asked that can't be written back to the DB.
 */
export const SURVEY_FIELDS: SurveyField[] = [
  // --- Contact (alumni_contact_info) ---
  { key: "contact.personal_email", table: "alumni_contact_info", column: "personal_email", label: "Personal email", group: "contact", kind: "text" },
  { key: "contact.work_email", table: "alumni_contact_info", column: "work_email", label: "Work email", group: "contact", kind: "text" },
  { key: "contact.phone", table: "alumni_contact_info", column: "phone", label: "Phone", group: "contact", kind: "text" },
  { key: "contact.address_line_1", table: "alumni_contact_info", column: "address_line_1", label: "Address line 1", group: "contact", kind: "text" },
  { key: "contact.address_line_2", table: "alumni_contact_info", column: "address_line_2", label: "Address line 2", group: "contact", kind: "text" },
  { key: "contact.city", table: "alumni_contact_info", column: "city", label: "City", group: "contact", kind: "text" },
  { key: "contact.state", table: "alumni_contact_info", column: "state", label: "State", group: "contact", kind: "text" },
  { key: "contact.zip", table: "alumni_contact_info", column: "zip", label: "ZIP / postal code", group: "contact", kind: "text" },
  { key: "contact.country", table: "alumni_contact_info", column: "country", label: "Country", group: "contact", kind: "text" },

  // --- Profile (alumni) ---
  // Name + marital status (#646/#647). These are on the SURVEY FORM, so they
  // have to be offerable in the email's "here's what we have on file" block too
  // — a field the survey asks about but the email cannot show is exactly the
  // drift this whitelist exists to prevent. Being listed here only makes them
  // AVAILABLE in the email column picker; it does not put them in the email.
  // `DEFAULT_EMAIL_FIELDS` decides that, and is deliberately unchanged.
  //
  // "Middle or Maiden name" matches the form's label — maiden names live in
  // `middle_name`; `birth_name` stays unused and is deliberately not listed.
  { key: "profile.first_name", table: "alumni", column: "first_name", label: "First name", group: "profile", kind: "text" },
  { key: "profile.middle_name", table: "alumni", column: "middle_name", label: "Middle or Maiden name", group: "profile", kind: "text" },
  { key: "profile.last_name", table: "alumni", column: "last_name", label: "Last name", group: "profile", kind: "text" },
  { key: "profile.preferred_first_name", table: "alumni", column: "preferred_first_name", label: "Preferred first name", group: "profile", kind: "text" },
  { key: "profile.marital_status", table: "alumni", column: "marital_status", label: "Marital status", group: "profile", kind: "text" },
  { key: "profile.employment_status", table: "alumni", column: "employment_status", label: "Current employment status", group: "profile", kind: "text" },
  { key: "profile.other_designations", table: "alumni", column: "other_designations", label: "Finance designations", group: "profile", kind: "text" },
  { key: "profile.linkedin_url", table: "alumni", column: "linkedin_url", label: "LinkedIn URL", group: "profile", kind: "text" },
  { key: "profile.graduate_degree", table: "alumni", column: "graduate_degree", label: "Graduate Program", group: "profile", kind: "text" },
  { key: "profile.graduate_school", table: "alumni", column: "graduate_school", label: "Graduate School", group: "profile", kind: "text" },
  { key: "profile.graduate_graduation_year", table: "alumni", column: "graduate_graduation_year", label: "Projected or completed graduation year", group: "profile", kind: "text" },
  { key: "profile.spouse_first_name", table: "alumni", column: "spouse_first_name", label: "Spouse first name", group: "profile", kind: "text" },
  { key: "profile.spouse_last_name", table: "alumni", column: "spouse_last_name", label: "Spouse last name", group: "profile", kind: "text" },
  // The rest of the form's "Personal details" group. These have been on the
  // survey and in the backend's submit whitelist for a while but were never
  // added here, so the email could not offer them — the same drift as the names
  // above, found alongside it. `kind` is "text" because this list only drives
  // how a value is DISPLAYED in the preview; the form owns the real control
  // (birthday renders as a date picker there).
  { key: "profile.gender", table: "alumni", column: "gender", label: "Gender", group: "profile", kind: "text" },
  { key: "profile.birth_date", table: "alumni", column: "birth_date", label: "Birthday", group: "profile", kind: "text" },
  { key: "profile.citizenship", table: "alumni", column: "citizenship", label: "Citizenship", group: "profile", kind: "text" },
  { key: "profile.home_country", table: "alumni", column: "home_country", label: "Home country", group: "profile", kind: "text" },

  // --- Employment (current_employment) ---
  { key: "employment.current_employer", table: "current_employment", column: "current_employer", label: "Current employer", group: "employment", kind: "text" },
  { key: "employment.current_title", table: "current_employment", column: "current_title", label: "Current title", group: "employment", kind: "text" },
  { key: "employment.current_industry", table: "current_employment", column: "current_industry", label: "Industry", group: "employment", kind: "text" },
  { key: "employment.current_industry_secondary", table: "current_employment", column: "current_industry_secondary", label: "Secondary industry", group: "employment", kind: "text" },
  { key: "employment.current_city", table: "current_employment", column: "current_city", label: "Work city", group: "employment", kind: "text" },
  { key: "employment.current_state", table: "current_employment", column: "current_state", label: "Work state", group: "employment", kind: "text" },
  { key: "employment.current_country", table: "current_employment", column: "current_country", label: "Work country", group: "employment", kind: "text" },
  { key: "employment.seniority_level", table: "current_employment", column: "seniority_level", label: "Seniority level", group: "employment", kind: "text" },
  // Also on the form and in the backend whitelist, also never listed here.
  { key: "employment.current_zip", table: "current_employment", column: "current_zip", label: "Company ZIP", group: "employment", kind: "text" },

  // --- Willingness & engagement (alumni_program_engagement booleans → tags) ---
  { key: "program.mentor_willing", table: "alumni_program_engagement", column: "mentor_willing", label: "Willing to mentor students", group: "engagement", kind: "boolean" },
  { key: "program.women_in_finance_mentor_willing", table: "alumni_program_engagement", column: "women_in_finance_mentor_willing", label: "Willing to mentor for Women in Finance", group: "engagement", kind: "boolean" },
  { key: "program.guest_speaker_willing", table: "alumni_program_engagement", column: "guest_speaker_willing", label: "Willing to be a guest speaker", group: "engagement", kind: "boolean" },
  { key: "program.help_at_event_willing", table: "alumni_program_engagement", column: "help_at_event_willing", label: "Willing to help at an event", group: "engagement", kind: "boolean" },
  { key: "program.nettrek_host_willing", table: "alumni_program_engagement", column: "nettrek_host_willing", label: "Willing to host a NetTrek visit", group: "engagement", kind: "boolean" },
  { key: "program.finance_conference_willing", table: "alumni_program_engagement", column: "finance_conference_willing", label: "Willing to take part in the finance conference", group: "engagement", kind: "boolean" },
  { key: "program.company_event_sponsor_willing", table: "alumni_program_engagement", column: "company_event_sponsor_willing", label: "Willing to sponsor a company event", group: "engagement", kind: "boolean" },
  { key: "program.case_competition_host_willing", table: "alumni_program_engagement", column: "case_competition_host_willing", label: "Willing to host a case competition", group: "engagement", kind: "boolean" },
  { key: "program.hired_finance_intern", table: "alumni_program_engagement", column: "hired_finance_intern", label: "Hired a BYU finance intern", group: "engagement", kind: "boolean" },
  { key: "program.hired_finance_full_time", table: "alumni_program_engagement", column: "hired_finance_full_time", label: "Hired a BYU finance grad full-time", group: "engagement", kind: "boolean" },
  { key: "program.cfa_designation", table: "alumni_program_engagement", column: "cfa_designation", label: "CFA designation", group: "engagement", kind: "boolean" },
  { key: "program.cfp_designation", table: "alumni_program_engagement", column: "cfp_designation", label: "CFP designation", group: "engagement", kind: "boolean" },
  { key: "program.cpa_designation", table: "alumni_program_engagement", column: "cpa_designation", label: "CPA designation", group: "engagement", kind: "boolean" },

  // --- Giving (alumni_program_engagement.piff_donor) ---
  { key: "program.piff_donor", table: "alumni_program_engagement", column: "piff_donor", label: "Pay It Forward donor", group: "giving", kind: "boolean", donateUrl: PAY_IT_FORWARD_URL },
];

/** Fast lookup from a question's `fieldKey` to its column definition. */
export const SURVEY_FIELD_BY_KEY: Record<string, SurveyField> =
  Object.fromEntries(SURVEY_FIELDS.map((f) => [f.key, f]));
