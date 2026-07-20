/**
 * By-class re-survey CAMPAIGN model (frontend-only prototype).
 *
 * This is the data behind the "send re-surveys by graduation year" console on
 * the Needs Surveying tab. It sits alongside `survey.ts` (which models the
 * questions an alum answers); this file models the *campaign* around those
 * questions — who was sent what, who hasn't replied, and what the replies would
 * change on each record.
 *
 * There is NO backend for survey campaigns yet, so every value here is MOCK data
 * (see `src/lib/sampleCampaigns.ts`) and every action in the console is staged in
 * component state only — no email is ever sent and no record is ever written.
 *
 * Field-level changes reference the SAME column whitelist the survey is built
 * from: a `ProposedChange.fieldKey` is a `key` from `SURVEY_FIELDS` in
 * `survey.ts`, and its `label` reuses that field's label so the report speaks
 * the same language as the questions.
 */

/** A single non-responder for a class — surfaced so staff can reach out by hand. */
export interface NoReplyAlum {
  alumniId: number;
  name: string;
  email: string;
}

/**
 * One field a response would change on an alum's record. `fieldKey` references a
 * `SURVEY_FIELDS` column (`survey.ts`); `label` mirrors that field's label.
 * `before` is what's on file today, `after` is what the alum submitted.
 */
export interface ProposedChange {
  fieldKey: string;
  label: string;
  before: string;
  after: string;
}

/** One alum's set of proposed changes (only alumni who actually changed something). */
export interface ChangeRecord {
  alumniId: number;
  name: string;
  changes: ProposedChange[];
}

/**
 * One send of the survey to a class. `sentDate` is an ISO date (`YYYY-MM-DD`) or
 * null when the round hasn't gone out yet. `recipients` is how many alumni it
 * targeted; `responses` is how many replied.
 */
export interface SurveyRound {
  sentDate: string | null;
  recipients: number;
  responses: number;
}

/**
 * A graduating class's whole re-survey campaign: the two sends (initial +
 * no-reply follow-up), the current non-responder list, how many responders had
 * nothing to change, the per-alum proposed changes, and whether the class's
 * changes have been applied ("submitted").
 */
export interface ClassCampaign {
  gradYear: number;
  totalAlumni: number;
  round1: SurveyRound;
  round2: SurveyRound;
  /** When this graduation year is next scheduled to be surveyed (ISO date). */
  nextSendDate: string;
  noReply: NoReplyAlum[];
  noChangeCount: number;
  changeRecords: ChangeRecord[];
  submitted: boolean;
}
