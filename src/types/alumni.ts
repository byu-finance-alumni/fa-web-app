/** Mirrors the backend AlumniRead / AlumniPage schemas (fa-web-api). */
export interface Alumni {
  alumni_id: number;
  byu_id: string | null;
  net_id: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  preferred_first_name: string | null;
  gender: string | null;
  /** Full date of birth, ISO "YYYY-MM-DD". `birth_year` is kept separately. */
  birth_date: string | null;
  graduation_year: number | null;
  finance_program_year: number | null;
  graduate_degree: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  /** Spouse's date of birth, ISO "YYYY-MM-DD". */
  spouse_birth_date: string | null;
  /** Set when the spouse is also an alumnus — links to that record. */
  spouse_alumni_id: number | null;
  deceased: boolean;
  archived: boolean;
  linkedin_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Present on alumni-list rows (joined from current_employment); absent on
   * single-record reads. */
  current_employer?: string | null;
  current_industry?: string | null;
}

export interface AlumniPage {
  items: Alumni[];
  total: number;
  limit: number;
  offset: number;
}

/** Mirrors the backend UserContext (auth/context). */
export interface UserContext {
  user_id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
}
