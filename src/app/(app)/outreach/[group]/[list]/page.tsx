import Link from "next/link";
import { notFound } from "next/navigation";
import { LoadError } from "@/components/shared/LoadError";
import { ScrollToTopOnPageChange } from "@/components/shared/ScrollToTopOnPageChange";
import { NetTrekReportTable } from "@/components/nettreks/NetTrekReportTable";
import { ReportFiltersBar } from "@/components/nettreks/ReportFiltersBar";
import { OutreachExportButton } from "@/components/outreach/OutreachExportButton";
import { Topbar } from "@/components/shell/Topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, apiGet } from "@/lib/api";
import { isReportFiltered, parseReportView, type ReportView } from "@/lib/reportView";
import { parseNetTrekOffset } from "@/lib/nettreks";
import {
  OUTREACH_PAGE_SIZE,
  cleanIndustry,
  isOutreachGroupKey,
  isOutreachListKey,
  outreachGroupHref,
  outreachGroupLabel,
  outreachListApiPath,
  outreachListExists,
  outreachListHref,
  type OutreachListPage,
} from "@/lib/outreach";

/**
 * One Outreach list ("Potential Alumni Speakers in Utah", "Investment Banking
 * Mentors", …): the NetTrek reports' table, server-side sort, filters and
 * pagination, and a Download CSV of the whole list as filtered and sorted. `GET /outreach/{group}/{key}` is gated on
 * `alumni.export` and writes a disclosure-audit row; the CSV is rate-limited
 * and audit-logged as an export. A list the page does not have is a 404 here
 * before any request is made.
 */
export default async function OutreachListRoute({
  params,
  searchParams,
}: {
  params: Promise<{ group: string; list: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { group, list } = await params;
  const sp = await searchParams;
  const industry = cleanIndustry(sp.industry);
  if (!isOutreachGroupKey(group) || !isOutreachListKey(list)) notFound();
  if (!outreachListExists(group, list, industry)) notFound();
  if (industry !== null && industry.length > 255) notFound();
  const offset = parseNetTrekOffset(sp.offset);
  const view = parseReportView(sp);

  let data: OutreachListPage | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<OutreachListPage>(
      outreachListApiPath(group, list, industry, offset, view),
    );
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load the list.");
  }

  const groupLabel = data?.group_title ?? outreachGroupLabel(group);
  const title = data?.title ?? groupLabel;
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + data.items.length, data.total) : 0;
  const hasPrev = offset > 0;
  const filtered = isReportFiltered(view);
  const hasNext = data ? offset + OUTREACH_PAGE_SIZE < data.total : false;

  return (
    <>
      <Topbar title={title} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <ScrollToTopOnPageChange offset={offset} />
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={outreachGroupHref(group)}
                className="text-sm text-brand-blue-600 underline-offset-4 hover:underline"
              >
                All {groupLabel} lists
              </Link>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">
                {title}
              </h1>
              {data && (
                <p className="mt-1 text-sm tabular-nums text-gray-500">
                  {data.total.toLocaleString("en-US")}{" "}
                  {data.total === 1 ? "person" : "people"}
                  {filtered ? " · filtered" : ""}
                </p>
              )}
            </div>
            {data && data.total > 0 && (
              <OutreachExportButton
                group={group}
                listKey={list}
                industry={industry}
                title={title}
                view={view}
              />
            )}
          </div>

          {data && (data.total > 0 || filtered) && (
            <ReportFiltersBar
              key={JSON.stringify(view.filters)}
              path={outreachListHref(group, list, industry)}
              view={view}
              options={data.filter_options}
            />
          )}

          {error ? (
            <LoadError status={error.status} noun="this list" />
          ) : data!.items.length === 0 ? (
            <Card className="p-10 text-center text-sm text-gray-500">
              {data!.total === 0
                ? filtered
                  ? "Nobody on this list matches these filters."
                  : "Nobody is on this list yet."
                : "This page is past the end of the list."}
            </Card>
          ) : (
            <>
              <NetTrekReportTable
                rows={data!.items}
                view={view}
                viewHref={(v: ReportView) => outreachListHref(group, list, industry, 0, v)}
                canSeeGender={data!.filter_options.gender !== null}
              />
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span className="tabular-nums">
                  Showing {from}–{to} of {data!.total.toLocaleString("en-US")}
                </span>
                <div className="flex gap-2">
                  <PageLink
                    href={outreachListHref(
                      group,
                      list,
                      industry,
                      Math.max(0, offset - OUTREACH_PAGE_SIZE),
                      view,
                    )}
                    enabled={hasPrev}
                    label="‹ Prev"
                  />
                  <PageLink
                    href={outreachListHref(group, list, industry, offset + OUTREACH_PAGE_SIZE, view)}
                    enabled={hasNext}
                    label="Next ›"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function PageLink({
  href,
  enabled,
  label,
}: {
  href: string;
  enabled: boolean;
  label: string;
}) {
  return enabled ? (
    <Button asChild variant="secondary">
      <Link href={href}>{label}</Link>
    </Button>
  ) : (
    <Button variant="secondary" disabled>
      {label}
    </Button>
  );
}
