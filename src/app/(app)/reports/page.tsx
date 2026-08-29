import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { Topbar } from "@/components/shell/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadError } from "@/components/shared/LoadError";
import {
  MISSING_PHOTO_UNAVAILABLE_NOTE,
  reportCount,
  visibleRelatedSurfaces,
  visibleReportSections,
  type DataQuality,
  type Report,
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
 * It also deliberately does NOT recompute anything: the counts come from the
 * same `GET /dashboard/data-quality` the Data quality page reads, and the survey
 * entries link to the campaign console instead of restating its arithmetic.
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

  /** A report's headline figure — null is UNKNOWN, never zero. */
  const countFor = (report: Report) =>
    report.countKey ? reportCount(dq?.[report.countKey]) : null;

  return (
    <>
      <Topbar title="Reports" />
      <main className="flex-1 overflow-auto p-6">
        {error ? (
          <LoadError status={error.status} noun="the reports" />
        ) : (
          <div className="space-y-5">
            <Card>
              <CardContent className="px-5 py-4">
                <p className="max-w-3xl text-sm leading-relaxed text-gray-700">
                  The reports staff run most often, each one a link to the list
                  behind it. These are shortcuts, not the whole set — the alumni
                  list filters on nearly every field and exports exactly the rows
                  it shows, so a report that is not here is a filter away.
                </p>
              </CardContent>
            </Card>

            {sections.map((section) => (
              <Card key={section.id}>
                <CardHeader className="flex-col items-start gap-1">
                  <CardTitle>{section.title}</CardTitle>
                  <p className="text-xs text-gray-500">{section.blurb}</p>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-gray-100">
                    {section.reports.map((report) => {
                      const count = countFor(report);
                      const unavailable = count?.unavailable ?? false;
                      return (
                        <li
                          key={report.id}
                          className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between lg:gap-6"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {report.title}
                              </p>
                              {count ? (
                                // Text, not colour alone (UX-UI.md
                                // Accessibility): "Unavailable" reads the same
                                // to a screen reader as it does on screen, and
                                // cannot be mistaken for a count of zero.
                                <Badge
                                  variant={count.tone}
                                  className={
                                    unavailable ? undefined : "tabular-nums"
                                  }
                                >
                                  {count.value}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-600">
                              {report.description}
                            </p>
                            {report.note ? (
                              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">
                                {report.note}
                              </p>
                            ) : null}
                            {unavailable ? (
                              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-warning-600">
                                {MISSING_PHOTO_UNAVAILABLE_NOTE}
                              </p>
                            ) : null}
                            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-gray-500">
                              {report.source}
                            </p>
                          </div>
                          <div className="shrink-0">
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
              <Card>
                <CardHeader className="flex-col items-start gap-1">
                  <CardTitle>Where the rest lives</CardTitle>
                  <p className="text-xs text-gray-500">
                    These screens own their own numbers. Reports links to them
                    rather than repeating the counts, so there is never a second
                    answer to the same question.
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-gray-100">
                    {related.map((surface) => (
                      <li
                        key={surface.href}
                        className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between lg:gap-6"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {surface.title}
                          </p>
                          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-600">
                            {surface.description}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <Button asChild variant="link" size="sm">
                            <Link
                              href={surface.href}
                              aria-label={`Open ${surface.title}`}
                            >
                              Open
                            </Link>
                          </Button>
                        </div>
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
