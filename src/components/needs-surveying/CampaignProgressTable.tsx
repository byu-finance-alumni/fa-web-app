"use client";

/**
 * Every graduation year's campaign progress at once (#543).
 *
 * The console is otherwise one-year-at-a-time: pick a year, see its counts,
 * pick the next. That is fine for running a campaign and useless for answering
 * "how is it going", which needs all of them side by side.
 *
 * Reads the same `GET /survey/schedules` payload the console already fetches —
 * no second endpoint, so this table and the per-year view cannot disagree about
 * a number. Every count is scoped to the year's CURRENT campaign, so a year on
 * its second cycle shows this cycle's response rate, not a lifetime average.
 */
import type { components } from "@/types/api.gen";
import { Card } from "@/components/ui/card";
import {
  formatRate,
  toProgressRows,
  totalProgress,
} from "./campaign-progress";

type SurveyScheduleItem = components["schemas"]["SurveyScheduleItem"];

const TH = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";
const TD = "px-3 py-2 text-sm text-gray-700 tabular-nums";

export function CampaignProgressTable({
  schedules,
}: {
  schedules: SurveyScheduleItem[] | null;
}) {
  if (schedules === null) {
    return (
      <Card className="mt-4 p-5">
        <p className="text-sm text-gray-500">Loading campaign progress…</p>
      </Card>
    );
  }
  if (schedules.length === 0) {
    // Distinct from "campaigns exist but nothing has been sent" — that case
    // renders the table with dashes, which is a different and truer statement.
    return null;
  }

  const rows = toProgressRows(schedules);
  const totals = totalProgress(rows);

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Campaign progress
        </h2>
        <p className="text-xs text-gray-400">
          Every graduation year&apos;s current campaign. Counts cover this
          campaign only, not previous ones.
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className={TH}>Year</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Emailed</th>
              <th className={`${TH} text-right`}>Replied</th>
              <th className={`${TH} text-right`}>Rate</th>
              <th className={`${TH} text-right`}>No reply yet</th>
              <th className={`${TH} text-right`}>To review</th>
              <th className={`${TH} text-right`}>Needs follow-up</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.graduationYear} className="border-b border-gray-100">
                <td className={`${TD} font-medium text-navy-800`}>
                  {r.graduationYear}
                </td>
                <td className={`${TD} capitalize`}>{r.status}</td>
                <td className={`${TD} text-right`}>
                  {r.emailed.toLocaleString()}
                </td>
                <td className={`${TD} text-right`}>
                  {r.replied.toLocaleString()}
                </td>
                <td className={`${TD} text-right font-medium text-navy-800`}>
                  {formatRate(r.responseRate)}
                </td>
                <td className={`${TD} text-right`}>
                  {r.silent.toLocaleString()}
                </td>
                {/* The two actionable columns. "To review" is a queue someone
                    has to work; "Needs follow-up" is the cadence being over
                    with no answer, i.e. time to call. */}
                <td className={`${TD} text-right`}>
                  {r.toReview > 0 ? (
                    <span className="font-semibold text-navy-800">
                      {r.toReview.toLocaleString()}
                    </span>
                  ) : (
                    "0"
                  )}
                </td>
                <td className={`${TD} text-right`}>
                  {r.needsFollowUp.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300">
              <td className={`${TD} font-semibold text-navy-800`} colSpan={2}>
                All years
              </td>
              <td className={`${TD} text-right font-semibold`}>
                {totals.emailed.toLocaleString()}
              </td>
              <td className={`${TD} text-right font-semibold`}>
                {totals.replied.toLocaleString()}
              </td>
              <td className={`${TD} text-right font-semibold text-navy-800`}>
                {formatRate(totals.responseRate)}
              </td>
              <td className={`${TD} text-right font-semibold`}>
                {totals.silent.toLocaleString()}
              </td>
              <td className={`${TD} text-right font-semibold`}>
                {totals.toReview.toLocaleString()}
              </td>
              <td className={`${TD} text-right font-semibold`}>
                {totals.needsFollowUp.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-400">
        A reply counts once it is submitted, whether or not it has been applied
        yet; a rejected submission does not count, so that alumnus still shows as
        awaiting a reply. &ldquo;Needs follow-up&rdquo; is the subset who have
        had all three emails and never answered.
      </p>
    </Card>
  );
}
