/**
 * Sample values used ONLY to pre-fill the survey preview so staff can see what
 * an alum would receive with real-looking data. Not persisted, not sent — purely
 * illustrative. Keyed by the `SURVEY_FIELDS` `key` (`table.column`). Only `text`
 * columns need a value here; `boolean` fields render as an unselected Yes/No.
 */
export const SAMPLE_ALUM: Record<string, string> = {
  // Contact
  "contact.personal_email": "jordan.avery@gmail.com",
  "contact.work_email": "javery@goldmansachs.com",
  "contact.phone": "(801) 555-0142",
  "contact.address_line_1": "742 Evergreen Terrace",
  "contact.address_line_2": "Apt 4",
  "contact.city": "Salt Lake City",
  "contact.state": "UT",
  "contact.zip": "84101",
  "contact.country": "United States",
  // Profile
  "profile.employment_status": "Employed",
  // Designations (#529): the CFA is a ticked box backed by its own column, so
  // the free text carries only what the presets don't cover.
  "program.cfa_designation": "Yes",
  "profile.other_designations": "Series 7, Series 66",
  "profile.linkedin_url": "linkedin.com/in/jordan-avery",
  "profile.graduate_degree": "MBA",
  "profile.graduate_school": "BYU Marriott School of Business",
  "profile.graduate_graduation_year": "2027",
  "profile.spouse_first_name": "Taylor",
  "profile.spouse_last_name": "Avery",
  // Employment
  "employment.current_employer": "Goldman Sachs",
  "employment.current_title": "Investment Banking Analyst",
  "employment.current_industry": "Investment Banking",
  "employment.current_industry_secondary": "Private Equity",
  "employment.current_city": "New York",
  "employment.current_state": "NY",
  "employment.current_country": "United States",
  "employment.seniority_level": "Analyst",
};

/** Display name for the sample alum, used in the preview intro line. */
export const SAMPLE_ALUM_NAME = "Jordan Avery";
