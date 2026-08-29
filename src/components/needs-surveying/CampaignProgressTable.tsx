"use client";

/**
 * Every graduation year's campaign progress at once (#543).
 *
 * The console is otherwise one-year-at-a-time: pick a year, see its counts,
 * pick the next. That is fine for running a campaign and useless for answering
 * "how is it going", which needs all of them side by side.
 *
 * Lives in its own "Progress" tab. It is the one panel in the console that is
 * NOT about the selected year — the overview you read before deciding which
 * year to go and work on.
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
  failed = false,
}: {
  schedules: SurveyScheduleItem[] | null;
  /** True when `GET /survey/schedules` failed, as opposed to returning none. */
  failed?: boolean;
}) {
  if (schedules === null) {
    return (
      <Card className="p-5">
        <p className="text-sm text-gray-500">Loading campaign progress…</p>
      </Card>
    );
  }
  if (failed) {
    // #688. The empty state below used to cover this case too, and on this
    // screen that conflation is expensive: a year can only be surveyed ONCE and
    // a duplicate schedule fails silently, so "no campaigns yet" over a failed
    // read is an invitation to schedule a year that is already running.
    return (
      <Card className="border-danger-600/20 bg-danger-50 p-5" role="alert">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Campaign progress
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          Couldn&rsquo;t load the campaigns. Nothing was loaded, so this is not
          &ldquo;no campaigns yet&rdquo;. Do not schedule a year from this
          screen until it reloads.
        </p>
      </Card>
    );
  }
  if (schedules.length === 0) {
    // Say so rather than rendering nothing. Returning null here meant that a
    // failed fetch, a permissions problem and "no campaigns yet" all looked
    // identical from the outside — an empty page you cannot tell apart from a
    // missing feature. The whole point of this table is to answer a question,
    // so it has to answer it even when the answer is "nothing has started".
    return (
      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Campaign progress
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          No campaigns yet. Once a graduation year is scheduled or sent to, its
          progress appears here.
        </p>
      </Card>
    );
  }

  const rows = toProgressRows(schedules);
  const totals = totalProgress(rows);

  return (
    <Card className="p-5">
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
        {/* The min-width is what keeps the columns from crushing into each
            other on a narrow laptop; below it the wrapper pans horizontally
            rather than wrapping headers. Applied/Rejected (#497) added roughly
            5rem each on top of the original 46rem. */}
        <table className="w-full min-w-[56rem] border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className={TH}>Year</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Emailed</th>
              <th className={`${TH} text-right`}>Replied</th>
              <th className={`${TH} text-right`}>Rate</th>
              <th className={`${TH} text-right`}>No reply yet</th>
              {/* The three submission outcomes sit together: pending review,
                  accepted, discarded. They are per-outcome distinct-alumni
                  counts, NOT a partition — see the note under the table. */}
              <th className={`${TH} text-right`}>To review</th>
              <th className={`${TH} text-right`}>Applied</th>
              <th className={`${TH} text-right`}>Rejected</th>
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
                {/* "To review" is the one column that is a to-do list rather
                    than a report — a queue someone has to work — so it is the
                    only count emphasised when non-zero. "Applied" and
                    "Rejected" beside it are what already happened to the rest
                    of the submissions; "Needs follow-up" at the end is the
                    cadence being over with no answer, i.e. time to call. */}
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
                  {r.applied.toLocaleString()}
                </td>
                <td className={`${TD} text-right`}>
                  {r.rejected.toLocaleString()}
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
                {totals.applied.toLocaleString()}
              </td>
              <td className={`${TD} text-right font-semibold`}>
                {totals.rejected.toLocaleString()}
              </td>
              <td className={`${TD} text-right font-semibold`}>
                {totals.needsFollowUp.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 text-xs text-gray-400">
        <p>
          A reply counts once it is submitted, whether or not it has been applied
          yet; a rejected submission does not count, so that alumnus still shows
          as awaiting a reply. &ldquo;Needs follow-up&rdquo; is the subset who
          have had all three emails and never answered.
        </p>
        {/* The two new columns (#497) are easy to misread in exactly two ways,
            so both are spelled out rather than left to inference. */}
        <p>
          &ldquo;To review&rdquo;, &ldquo;Applied&rdquo; and
          &ldquo;Rejected&rdquo; say what has happened to the submissions that
          came back. Rejecting one discards it, so that alumnus still owes a
          reply and is counted under &ldquo;Rejected&rdquo; <em>and</em> under
          &ldquo;No reply yet&rdquo;. That is deliberate, not a contradiction.
        </p>
        <p>
          Each of those three columns counts alumni, so they do not add up to
          &ldquo;Replied&rdquo; or to each other: someone who submitted twice and
          had one applied and one rejected appears in two of them. Read each
          column on its own rather than adding them together.
        </p>
      </div>
    </Card>
  );
}
