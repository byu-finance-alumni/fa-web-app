import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { CAPABILITY } from "@/constants/capabilities";
import { Topbar } from "@/components/shell/Topbar";
import { Badge } from "@/components/ui/badge";
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
          /* FULL WIDTH, like every other screen. An earlier pass capped this at
             max-w-3xl to pull the action closer to its label; it fixed that and
             made the page look like half a page (Jake, 2026-08-29). The row
             below solves the same problem the way Data quality already does. */
          <div className="space-y-5">
            {sections.map((section) => (
              <Card key={section.id}>
                <CardHeader className="flex-col items-start gap-1">
                  <CardTitle>{section.title}</CardTitle>
                  {/* Said ONCE, under the section. It used to render verbatim on
                      every row it applied to. */}
                  {section.note ? (
                    <p className="text-xs leading-relaxed text-gray-500">
                      {section.note}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {/* Same row as Data quality's "Open alerts": a tinted, rounded
                      band per row with the count badged on the left and the
                      action on the right. Reused rather than reinvented so the
                      two screens read as one product — and because the band is
                      what makes a row scannable at full width, without capping
                      the page to bring the button closer. */}
                  <ul className="space-y-2">
                    {section.reports.map((report) => {
                      const count = countFor(report);
                      const unavailable = count?.unavailable ?? false;
                      const surveyKey = report.surveyCountKey;
                      const detail =
                        surveyKey && campaign
                          ? surveyCountLabel(campaign, surveyKey)
                          : surveyKey && !campaign
                            ? SURVEY_COUNT_UNAVAILABLE_NOTE
                            : unavailable
                              ? MISSING_PHOTO_UNAVAILABLE_NOTE
                              : (report.note ?? null);
                      return (
                        <li
                          key={report.id}
                          className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            {count ? (
                              // Text, not colour alone (UX-UI.md Accessibility):
                              // "Unavailable" reads the same to a screen reader
                              // and cannot be mistaken for a count of zero.
                              <Badge
                                variant={count.tone}
                                className={
                                  unavailable
                                    ? "shrink-0"
                                    : "shrink-0 tabular-nums"
                                }
                              >
                                {count.value}
                              </Badge>
                            ) : null}
                            <div className="min-w-0">
                              <p className="text-sm text-gray-900">
                                {report.title}
                              </p>
                              {/* One line at most, and only where it stops a
                                  wrong conclusion. There is no `description`:
                                  see the note on `Report` in lib/reports.ts. */}
                              {detail ? (
                                <p
                                  className={
                                    "truncate text-xs " +
                                    (unavailable
                                      ? "text-warning-600"
                                      : "text-gray-500")
                                  }
                                >
                                  {detail}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <Button asChild variant="link" size="sm">
                            <Link
                              href={report.href}
                              aria-label={report.linkLabel}
                            >
                              {report.action}
                            </Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}

            {related.length > 0 && (
              /* Destinations, not reports — they carry no number, so they are a
                 row of names rather than something to read. */
              <Card>
                <CardHeader className="flex-col items-start">
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
