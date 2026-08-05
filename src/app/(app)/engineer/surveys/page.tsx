import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { isEngineer } from "@/constants/roles";
import { Topbar } from "@/components/shell/Topbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StopAllSurveys } from "@/components/engineer/StopAllSurveys";
import { PauseAllSurveys } from "@/components/engineer/PauseAllSurveys";
import { CampaignPauseControl } from "@/components/engineer/CampaignPauseControl";
import { SurveyCampaignReset } from "@/components/engineer/SurveyCampaignReset";
import { getSurveySchedules, type SurveyScheduleItem } from "./actions";

/**
 * The two statuses the daily send cron picks up (`_load_schedules_due`). A
 * campaign in either of these is LIVE — it will email on the next run — so
 * these are exactly what "active" means on this screen and what the two blanket
 * switches act on. `completed` and `cancelled` are inert history, and `paused`
 * is deliberately NOT here: a paused campaign sends nothing, which is the whole
 * point of it, but it isn't finished either — see PAUSED below.
 */
const RUNNING = new Set(["scheduled", "active"]);

/**
 * Held, not finished. A paused campaign emails nobody, so it is not counted as
 * live — but it is the one inert state that still needs a decision, so the
 * screen counts it separately rather than letting it disappear into history.
 */
const PAUSED = "paused";

// All times are shown in Utah time (Mountain). America/Denver tracks MST/MDT
// automatically, and timeZoneName: "short" stamps each row with the active
// abbreviation (MST/MDT) so it's unambiguous. Matches the Login failures tab.
function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Denver",
    timeZoneName: "short",
  });
}

/** A date-only `start_date` — rendered without a timezone so it can't shift a day. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Running campaigns read as danger — this screen exists to make them stoppable.
 * Paused reads as warning: nothing is sending, but the campaign is mid-flight
 * and waiting on someone, which is not the same as done.
 */
function statusVariant(
  status: string,
): "danger" | "warning" | "muted" | "neutral" {
  if (RUNNING.has(status)) return "danger";
  if (status === PAUSED) return "warning";
  return status === "cancelled" ? "muted" : "neutral";
}

/**
 * Engineer-only Surveys console: what survey campaigns are running, who started
 * each one and when, and a single control to stop them all.
 *
 * This is an incident tool. A campaign left `scheduled`/`active` keeps emailing
 * a cohort on every daily cron run, so the screen leads with the count of what
 * is live and puts the two blanket switches next to it — the per-year cancel on
 * Manage → Needs Surveying is the routine control, these are the blanket ones.
 *
 * The two switches are deliberately unequal, because one is recoverable and the
 * other is not: Pause all is a plain button with a single confirm, Stop all is
 * the destructive button behind a two-step type-STOP guard. The copy between
 * them says which is which rather than relying on the styling alone.
 *
 * Gated to engineers in the UI (the /engineer/* group is gated in
 * engineer/layout.tsx; the page-level check below is belt-and-suspenders) and
 * the backend re-enforces RequireEngineer on the two blanket endpoints (and
 * full access on the per-year pause/resume).
 */
export default async function EngineerSurveysPage() {
  // Role gate (defense-in-depth): redirect non-engineers — and any authed-but-
  // unprovisioned user (getAuthContext throws → null) — to the dashboard rather
  // than rendering a dead-end shell.
  const gate = await getAuthContext().catch(() => null);
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");

  let schedules: SurveyScheduleItem[] | null = null;
  let error: ApiError | null = null;
  try {
    schedules = await getSurveySchedules();
  } catch (e) {
    error =
      e instanceof ApiError
        ? e
        : new ApiError(0, "Failed to load the survey campaigns.");
  }

  const running = (schedules ?? []).filter((s) => RUNNING.has(s.status));
  const activeYears = running.map((s) => s.graduation_year).sort((a, b) => a - b);
  const pausedYears = (schedules ?? [])
    .filter((s) => s.status === PAUSED)
    .map((s) => s.graduation_year)
    .sort((a, b) => a - b);

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Engineer", href: "/engineer" }, { label: "Surveys" }]}
      />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="sr-only">Surveys</h1>

        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "Engineer access required"
                : "Couldn’t load the survey campaigns"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {error.status === 403
                ? "The survey console is restricted to engineers."
                : error.message}
            </p>
          </Card>
        ) : (
          <>
            {/* Lead with the live count + the blanket switches — the things this
                screen exists for. Everything below is the supporting detail. */}
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Active campaigns
                  </p>
                  <p
                    className={`text-4xl font-semibold tabular-nums tracking-tight ${
                      activeYears.length > 0 ? "text-danger-600" : "text-navy-800"
                    }`}
                  >
                    {activeYears.length}
                  </p>
                  <p className="mt-1 max-w-xl text-sm text-gray-500">
                    {activeYears.length > 0 ? (
                      <>
                        Graduation year
                        {activeYears.length === 1 ? " " : "s "}
                        <span className="font-medium text-gray-700">
                          {activeYears.join(", ")}
                        </span>{" "}
                        will send again on the next daily run — initial or
                        reminder, whichever is due.
                      </>
                    ) : (
                      "Nothing is scheduled or mid-campaign. No survey emails will send."
                    )}
                  </p>
                  {pausedYears.length > 0 ? (
                    <p className="mt-2 max-w-xl text-sm text-gray-500">
                      <span className="font-medium text-warning-600">
                        {pausedYears.length} paused
                      </span>{" "}
                      — graduation year
                      {pausedYears.length === 1 ? " " : "s "}
                      <span className="font-medium text-gray-700">
                        {pausedYears.join(", ")}
                      </span>{" "}
                      {pausedYears.length === 1 ? "is" : "are"} held and sending
                      nothing. Resume {pausedYears.length === 1 ? "it" : "them"}{" "}
                      below when ready.
                    </p>
                  ) : null}
                </div>
                {/* Reversible first, terminal second — and the line beneath
                    spells out the difference, since the two sit together. */}
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <div className="flex flex-wrap gap-2">
                    <PauseAllSurveys activeYears={activeYears} />
                    <StopAllSurveys activeYears={activeYears} />
                  </div>
                  <p className="max-w-xs text-xs text-gray-500 sm:text-right">
                    <span className="font-medium text-gray-700">Pause</span> is
                    reversible — resuming picks each campaign up where it left
                    off.{" "}
                    <span className="font-medium text-gray-700">Stop</span> is
                    permanent: a cancelled campaign has to be re-scheduled by
                    hand.
                  </p>
                </div>
              </div>
            </Card>

            {/* The per-person tool, between the blanket switches and the
                per-cohort table: it is neither, and it is the one control here
                that destroys data rather than stopping a send (#395). */}
            <div className="mt-4">
              <SurveyCampaignReset />
            </div>

            <p className="mb-4 mt-4 max-w-3xl text-sm text-gray-500">
              Every survey campaign the scheduler knows about, newest cohort
              first. Only{" "}
              <span className="font-medium text-gray-700">scheduled</span> and{" "}
              <span className="font-medium text-gray-700">active</span> ones
              send. <span className="font-medium text-gray-700">Pausing</span>{" "}
              stops a campaign without ending it — the time it spends paused
              doesn’t count against its reminder schedule, so resuming continues
              the cadence instead of skipping ahead. Cancelling also stops it,
              but a cancelled campaign does not resume. Times are shown in{" "}
              <span className="font-medium text-gray-700">
                Utah time (Mountain)
              </span>
              . To cancel a single year, use Manage → Needs Surveying.
            </p>

            {schedules && schedules.length === 0 ? (
              <Card className="p-10 text-center text-sm text-gray-500">
                No survey campaigns have ever been scheduled.
              </Card>
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="space-y-2 md:hidden">
                  {schedules!.map((s) => (
                    <Card key={s.survey_schedule_id} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          Class of {s.graduation_year}
                        </p>
                        <Badge variant={statusVariant(s.status)}>
                          {s.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Starts {formatDate(s.start_date)} · last run{" "}
                        {formatDateTime(s.last_run_at)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Started by {s.created_by ?? "Unknown"} on{" "}
                        {formatDateTime(s.created_at)}
                      </p>
                      {s.status === PAUSED ? (
                        <p className="mt-1 text-xs text-warning-600">
                          Paused {formatDateTime(s.paused_at)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs tabular-nums text-gray-500">
                        Sent {s.sent_initial} initial · {s.sent_reminder_1} 1-week
                        · {s.sent_reminder_2} 2-week
                      </p>
                      <div className="mt-2">
                        <CampaignPauseControl
                          graduationYear={s.graduation_year}
                          status={s.status}
                        />
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Desktop: table */}
                <Card className="hidden overflow-hidden p-0 md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                        <th className="w-24 px-4 py-3">Class</th>
                        <th className="w-44 px-4 py-3">Status</th>
                        <th className="w-36 px-4 py-3">Starts</th>
                        <th className="px-4 py-3">Started by</th>
                        <th className="w-56 px-4 py-3">Created (Utah)</th>
                        <th className="w-56 px-4 py-3">Last run (Utah)</th>
                        <th className="w-40 px-4 py-3 text-right">
                          Sent — init / 1wk / 2wk
                        </th>
                        <th className="w-28 px-4 py-3 text-right">
                          <span className="sr-only">Pause or resume</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules!.map((s) => (
                        <tr
                          key={s.survey_schedule_id}
                          className="border-b border-gray-200 last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 font-medium tabular-nums text-gray-900">
                            {s.graduation_year}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(s.status)}>
                              {s.status}
                            </Badge>
                            {/* A paused campaign that nobody resumes is the
                                failure mode here, so the stamp rides with the
                                badge rather than hiding in another column. */}
                            {s.status === PAUSED ? (
                              <span className="mt-1 block text-xs text-warning-600">
                                since {formatDateTime(s.paused_at)}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatDate(s.start_date)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {s.created_by ?? (
                              <span className="text-gray-400">Unknown</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatDateTime(s.created_at)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatDateTime(s.last_run_at)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                            {s.sent_initial} / {s.sent_reminder_1} /{" "}
                            {s.sent_reminder_2}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <CampaignPauseControl
                              graduationYear={s.graduation_year}
                              status={s.status}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
