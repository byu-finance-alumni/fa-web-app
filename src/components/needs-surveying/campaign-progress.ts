/**
 * The numbers behind the at-a-glance campaign table (#543).
 *
 * Pure, so the arithmetic that decides what staff read off the screen is
 * testable without rendering anything. The backend supplies `recipients`,
 * `replied` and `awaiting_review` per year, already scoped to that year's
 * current cycle; everything derived from them lives here rather than inline in
 * JSX, where a wrong denominator is invisible.
 */
import type { components } from "@/types/api.gen";

type SurveyScheduleItem = components["schemas"]["SurveyScheduleItem"];

export type CampaignProgressRow = {
  graduationYear: number;
  status: string;
  /** Distinct alumni emailed in this cycle. The denominator for everything. */
  emailed: number;
  replied: number;
  /** Emailed and not yet replied. Includes people mid-cadence who may still. */
  silent: number;
  /** Replies sitting in the review queue — the actionable number. */
  toReview: number;
  /**
   * Had all three emails and never replied (`non_responders`). A SUBSET of
   * `silent`, and a much stronger claim: these people are done with the
   * automated cadence, so the only thing left is someone picking up the phone.
   */
  needsFollowUp: number;
  /** 0–100, or null when nobody has been emailed yet — a rate over zero
   *  recipients is not 0%, it is undefined, and showing "0%" for a campaign
   *  that has not started reads as a failure rather than as "not yet". */
  responseRate: number | null;
};

export function toProgressRow(item: SurveyScheduleItem): CampaignProgressRow {
  const emailed = item.recipients ?? 0;
  const replied = item.replied ?? 0;
  return {
    graduationYear: item.graduation_year,
    status: item.status,
    emailed,
    replied,
    // Clamped: `replied` can only exceed `emailed` if the two counts were built
    // from different populations, which would be a backend bug — but a negative
    // "still silent" on screen would be a puzzle rather than a report.
    silent: Math.max(0, emailed - replied),
    toReview: item.awaiting_review ?? 0,
    needsFollowUp: item.non_responders ?? 0,
    responseRate: emailed > 0 ? Math.round((replied / emailed) * 100) : null,
  };
}

/** Newest cohort first — the campaign most likely to be running right now. */
export function toProgressRows(
  items: SurveyScheduleItem[],
): CampaignProgressRow[] {
  return [...items]
    .map(toProgressRow)
    .sort((a, b) => b.graduationYear - a.graduationYear);
}

export type CampaignProgressTotals = Omit<
  CampaignProgressRow,
  "graduationYear" | "status"
>;

/**
 * Account-wide totals.
 *
 * The overall rate is recomputed from the summed counts, NOT averaged from the
 * per-year rates: averaging percentages weights a 4-person cohort the same as a
 * 400-person one and quietly reports a number that is true of no population.
 */
export function totalProgress(
  rows: CampaignProgressRow[],
): CampaignProgressTotals {
  const emailed = rows.reduce((n, r) => n + r.emailed, 0);
  const replied = rows.reduce((n, r) => n + r.replied, 0);
  return {
    emailed,
    replied,
    silent: rows.reduce((n, r) => n + r.silent, 0),
    toReview: rows.reduce((n, r) => n + r.toReview, 0),
    needsFollowUp: rows.reduce((n, r) => n + r.needsFollowUp, 0),
    responseRate: emailed > 0 ? Math.round((replied / emailed) * 100) : null,
  };
}

/** "—" for an undefined rate, so an unstarted campaign never reads as 0%. */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate}%`;
}
