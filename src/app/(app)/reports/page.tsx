import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { CAPABILITY } from "@/constants/capabilities";
import { Topbar } from "@/components/shell/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadError } from "@/components/shared/LoadError";
import {
  MISSING_PHOTO_UNAVAILABLE_NOTE,
  SURVEY_COUNT_UNAVAILABLE_NOTE,
  quotedCampaign,
  reportCount,
  surveyCount,
  surveyCountLabel,
  visibleRelatedSurfaces,
  visibleReportSections,
  type DataQuality,
  type Report,
  type SurveySchedule,
} from "@/lib/reports";

export const metadata = {
  title: "Reports",
};

/**
 * Reports (#775) — named shortcuts to the handful of lists staff run often.
 *
 * NOT a report builder. Tanya asked whether every report has to be enumerated up
 * front; it does not, because the alumni list already filters on most fields and
 * its CSV export is derived from the same population params. So this page is a
 * menu of the frequent ones, each a link — the definitions all live in
 * `@/lib/reports`, where the list-backed hrefs are SERIALIZED from the filter
 * model rather than typed by hand.
 *
 * It also deliberately does NOT recompute anything: the data-quality counts come
 * from the same `GET /dashboard/data-quality` the Data quality page reads, and
 * the survey figures are quoted straight off ONE campaign row from
 * `GET /survey/schedules` — never summed across classes, because campaigns are
 * per graduation year and a grand total would mean nothing (see
 * `quotedCampaign`).
 *
 * ⚠️ NOTHING ON THIS PAGE NAMES AN ENDPOINT (Jake, review of #775). The
 * provenance of every number is in the comments here and in `@/lib/reports`; a
 * staff screen does not carry HTTP methods and routes.
 *
 * Gated (nav + backend) on `reports.advanced`, the capability that already
 * covers Data quality, Activity and Tasks — and the one `/dashboard/data-quality`
 * itself requires, so the page cannot render a set of tiles that 403 on read.
 */
export default async function ReportsPage() {
  const [dqResult, authResult] = await Promise.allSettled([
    apiGet<DataQuality>("/dashboard/data-quality", {
      revalidate: 60,
      tags: ["dashboard"],
    }),
    readAuthContext(),
  ]);

  const dq = dqResult.status === "fulfilled" ? dqResult.value : null;
  const error =
    dqResult.status === "rejected"
      ? dqResult.reason instanceof ApiError
        ? dqResult.reason
        : new ApiError(0, "Failed to load the reports.")
      : null;

  // FAILS CLOSED, matching `getVisibleNav`: an unreadable context means we do
  // not know what this account may open, and offering a link that 403s on click
  // is worse than not offering it. Every capability-gated entry here is a
  // shortcut to a screen reachable from the nav anyway.
  const capabilities =
    authResult.status === "fulfilled" && authResult.value.status === "ok"
      ? authResult.value.ctx.capabilities
      : [];

  const sections = visibleReportSections(capabilities);
  const related = visibleRelatedSurfaces(capabilities);

  // The campaign figures, fetched ONLY for accounts that may read them — the
  // survey rows are hidden without `surveys.manage`, and the endpoint 403s
  // without it, so an unconditional call would be a guaranteed error for every
  // reports.advanced-only account. A failure degrades to "no number", never to a
  // zero: nobody has replied and we could not ask are different facts.
  const schedules = capabilities.includes(CAPABILITY.SURVEYS_MANAGE)
    ? await apiGet<SurveySchedule[]>("/survey/schedules", {
        revalidate: 60,
        tags: ["survey-schedules"],
      }).catch(() => null)
    : null;
  const campaign = quotedCampaign(schedules);

  /** A report's headline figure — null is UNKNOWN, never zero. */
  const countFor = (report: Report) => {
    if (report.countKey) return reportCount(dq?.[report.countKey]);
    if (report.surveyCountKey) return surveyCount(campaign, report.surveyCountKey);
    return null;
  };

  return (
    <>
      <Topbar title="Reports" />
      <main className="flex-1 overflow-auto p-6">
        {error ? (
          <LoadError status={error.status} noun="the reports" />
        ) : (
          /* Capped width on purpose (#814). Full-bleed rows put "Open the list"
             ~1,100px from the label it belongs to, so the eye had to cross the
             viewport to pair a count with its action. */
          <div className="max-w-3xl space-y-5">
            {sections.map((section) => (
              <Card key={section.id}>
                <CardHeader className="pb-2">
                  <CardTitle>{section.title}</CardTitle>
                  {/* Said ONCE, for the whole section. It used to render
                      verbatim on every row it applied to. */}
                  {section.note ? (
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      {section.note}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-gray-100">
                    {section.reports.map((report) => {
                      const count = countFor(report);
                      const unavailable = count?.unavailable ?? false;
                      const surveyKey = report.surveyCountKey;
                      // A satisfied row recedes. 0 and 247 carrying identical
                      // weight was half of "hard to tell what you're looking at".
                      const settled = count?.tone === "success";
                      return (
                        <li
                          key={report.id}
                          className="flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                        >
                          {/* The number leads. Fixed width + tabular-nums so the
                              figures form one column you can read straight down
                              (UX-UI.md Typography). */}
                          <div
                            className={
                              "w-14 shrink-0 pt-0.5 text-right text-2xl font-semibold leading-none tabular-nums " +
                              (unavailable
                                ? "text-warning-600"
                                : settled
                                  ? "text-gray-300"
                                  : "text-gray-900")
                            }
                          >
                            {unavailable ? "?" : (count?.value ?? "")}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className={
                                "text-sm font-semibold " +
                                (settled ? "text-gray-500" : "text-gray-900")
                              }
                            >
                              {report.title}
                            </p>
                            {/* No description line. The title is the description
                                — see the note on `Report` in lib/reports.ts. */}
                            {surveyKey && campaign ? (
                              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                                {surveyCountLabel(campaign, surveyKey)}
                              </p>
                            ) : null}
                            {surveyKey && !campaign ? (
                              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                                {SURVEY_COUNT_UNAVAILABLE_NOTE}
                              </p>
                            ) : null}
                            {/* Kept: without it the photo figure reads as a bug. */}
                            {report.note ? (
                              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                                {report.note}
                              </p>
                            ) : null}
                            {unavailable ? (
                              <p className="mt-0.5 text-xs leading-relaxed text-warning-600">
                                {MISSING_PHOTO_UNAVAILABLE_NOTE}
                              </p>
                            ) : null}
                          </div>

                          <div className="shrink-0 pt-0.5">
                            <Button asChild variant="secondary" size="sm">
                              <Link
                                href={report.href}
                                aria-label={report.linkLabel}
                              >
                                {report.action}
                              </Link>
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}

            {related.length > 0 && (
              /* A row of screen names, not titled rows with a sentence each.
                 These are destinations, not reports — they carry no number, so
                 they should not look like something you read. */
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Elsewhere</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {related.map((surface) => (
                      <li key={surface.href}>
                        <Link
                          href={surface.href}
                          className="text-sm font-medium text-royal-600 underline-offset-4 hover:underline"
                        >
                          {surface.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </>
  );
}
