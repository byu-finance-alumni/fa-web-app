import Link from "next/link";
import { notFound } from "next/navigation";
import { LoadError } from "@/components/shared/LoadError";
import { ScrollToTopOnPageChange } from "@/components/shared/ScrollToTopOnPageChange";
import { NetTrekExportButton } from "@/components/nettreks/NetTrekExportButton";
import { NetTrekReportTable } from "@/components/nettreks/NetTrekReportTable";
import { Topbar } from "@/components/shell/Topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, apiGet } from "@/lib/api";
import {
  NETTREKS_PAGE_SIZE,
  isNetTrekAreaKey,
  isNetTrekReportKind,
  netTrekReportApiPath,
  netTrekReportExists,
  netTrekReportHref,
  parseNetTrekOffset,
  type NetTrekReportPage,
} from "@/lib/nettreks";

/**
 * One NetTrek report (#887): "<Area> NetTrek Hosts" or "<Area> Area Alumni".
 *
 * The issue's columns, server-side pagination, and a Download CSV of the whole
 * report. `GET /nettreks/{area}/{kind}` is gated on `alumni.export` and writes
 * a disclosure-audit row; the CSV is rate-limited and audit-logged as an
 * export. An unknown area or kind, or Other's Area Alumni (it has none), is a
 * 404 here before any request is made.
 */
export default async function NetTrekReportRoute({
  params,
  searchParams,
}: {
  params: Promise<{ area: string; kind: string }>;
  searchParams: Promise<{ offset?: string | string[] }>;
}) {
  const { area, kind } = await params;
  if (!isNetTrekAreaKey(area) || !isNetTrekReportKind(kind)) notFound();
  if (!netTrekReportExists(area, kind)) notFound();
  const offset = parseNetTrekOffset((await searchParams).offset);

  let data: NetTrekReportPage | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<NetTrekReportPage>(
      netTrekReportApiPath(area, kind, offset),
    );
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load the report.");
  }

  const title =
    data?.title ?? (kind === "hosts" ? "NetTrek Hosts" : "Area Alumni");
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + data.items.length, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + NETTREKS_PAGE_SIZE < data.total : false;

  return (
    <>
      <Topbar title={title} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <ScrollToTopOnPageChange offset={offset} />
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/nettreks"
                className="text-sm text-brand-blue-600 underline-offset-4 hover:underline"
              >
                All NetTrek reports
              </Link>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">
                {title}
              </h1>
              {data && (
                <p className="mt-1 text-sm tabular-nums text-gray-500">
                  {data.total.toLocaleString("en-US")}{" "}
                  {data.total === 1 ? "person" : "people"}
                </p>
              )}
            </div>
            {data && data.total > 0 && (
              <NetTrekExportButton area={area} kind={kind} title={title} />
            )}
          </div>

          {error ? (
            <LoadError status={error.status} noun="this report" />
          ) : data!.items.length === 0 ? (
            <Card className="p-10 text-center text-sm text-gray-500">
              {data!.total === 0
                ? "Nobody is on this report yet."
                : "This page is past the end of the report."}
            </Card>
          ) : (
            <>
              <NetTrekReportTable rows={data!.items} />
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span className="tabular-nums">
                  Showing {from}–{to} of {data!.total.toLocaleString("en-US")}
                </span>
                <div className="flex gap-2">
                  <PageLink
                    href={netTrekReportHref(
                      area,
                      kind,
                      Math.max(0, offset - NETTREKS_PAGE_SIZE),
                    )}
                    enabled={hasPrev}
                    label="‹ Prev"
                  />
                  <PageLink
                    href={netTrekReportHref(area, kind, offset + NETTREKS_PAGE_SIZE)}
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
