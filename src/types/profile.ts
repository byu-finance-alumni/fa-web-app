/** Mirrors the backend ProfileRead aggregate (fa-web-api app/schemas/profile.py). */
import type { Alumni } from "./alumni";

export interface Contact {
  contact_info_id: number;
  personal_email: string | null;
  work_email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  region: string | null;
}

export interface CurrentCareer {
  current_employment_id: number;
  current_employer: string | null;
  current_title: string | null;
  current_industry: string | null;
  current_industry_secondary: string | null;
  current_city: string | null;
  current_state: string | null;
  current_country: string | null;
  current_zip: string | null;
  seniority_level: string | null;
  last_verified_at: string | null;
}

export interface EmploymentHistory {
  employment_history_id: number;
  employer_name: string | null;
  employment_title: string | null;
  employment_industry: string | null;
  city: string | null;
  state: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
}

export interface Education {
  education_id: number;
  university: string | null;
  college: string | null;
  department: string | null;
  degree: string | null;
  major: string | null;
  degree_status: string | null;
  degree_year: number | null;
}

export interface Leadership {
  finance_society_leadership_id: number;
  leadership_role: string;
  role_year: number | null;
}

export interface ProgramEngagement {
  engagement_profile_id: number;
  nettrek_host_willing: boolean;
  finance_conference_willing: boolean;
  mentor_willing: boolean;
  company_event_sponsor_willing: boolean;
  guest_speaker_willing: boolean;
  help_at_event_willing: boolean;
  case_competition_host_willing: boolean;
  women_in_finance_mentor_willing: boolean;
  hired_finance_intern: boolean;
  hired_finance_full_time: boolean;
  piff_donor: boolean;
  cfp_designation: boolean;
  cfa_designation: boolean;
  engagement_notes: string | null;
}

export interface EngagementNote {
  engagement_id: number;
  engagement_interest_type: string | null;
  engagement_notes: string | null;
}

export interface Survey {
  survey_id: number;
  survey_year: number | null;
  survey_due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  survey_status: string | null;
  survey_notes: string | null;
}

export interface Interaction {
  interaction_id: number;
  interaction_type: string | null;
  interaction_date_time: string | null;
  interaction_notes: string | null;
  user_id: number | null;
  logged_by: string | null;
}

export interface Task {
  follow_up_task_id: number;
  task_title: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  task_notes: string | null;
  assigned_to_user_id: number | null;
  assigned_to: string | null;
}

export interface Attachment {
  attachment_id: number;
  file_name: string;
  file_type: string | null;
  attachment_notes: string | null;
  uploaded_at: string;
  uploaded_by_user_id: number | null;
}

export interface EventAttended {
  event_id: number;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  event_location: string | null;
  attendance_status: string | null;
}

export interface AuditEntry {
  audit_log_id: number;
  action_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user_id: number | null;
}

export interface Profile {
  alumni: Alumni;
  /** Linked spouse's current display name when alumni.spouse_alumni_id is set. */
  spouse_alumni_name: string | null;
  contact: Contact | null;
  current_career: CurrentCareer | null;
  employment_history: EmploymentHistory[];
  education: Education[];
  leadership: Leadership[];
  program_engagement: ProgramEngagement | null;
  engagement_notes: EngagementNote[];
  tags: string[];
  status_labels: string[];
  surveys: Survey[];
  interactions: Interaction[];
  interaction_count: number;
  tasks: Task[];
  attachments: Attachment[];
  events: EventAttended[];
  audit: AuditEntry[];
}
