import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { MetricCard } from "@/components/shared/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface DataQuality {
  total_alumni: number;
  complete_alumni: number;
  missing_email: number;
  missing_employer: number;
  missing_phone: number;
  duplicate_count: number;
}

export default async function DataQualityPage() {
  let dq: DataQuality | null = null;
  let error: ApiError | null = null;
  try {
    dq = await apiGet<DataQuality>("/dashboard/data-quality", {
      revalidate: 60,
      tags: ["dashboard"],
    });
  } catch (e) {
    error =
      e instanceof ApiError
        ? e
        : new ApiError(0, "Failed to load data quality.");
  }

  const alerts = dq
    ? [
        {
          label: "Missing email",
          count: dq.missing_email,
          description:
            "Active alumni with no personal or work email on file — can't be reached for outreach.",
          href: "/alumni?missing_email=1",
          linkLabel: "Review alumni missing an email",
          /** UX-UI.md: missing-data = warning */
          tone: "warning" as const,
        },
        {
          label: "Missing employer",
          count: dq.missing_employer,
          description:
            "Active alumni with no current employer recorded — career data needs enrichment.",
          href: "/alumni?missing_employer=1",
          linkLabel: "Review alumni missing an employer",
          /** UX-UI.md: missing-data = warning */
          tone: "warning" as const,
        },
        {
          label: "Missing phone",
          count: dq.missing_phone,
          description:
            "Active alumni with no phone number on file — can't be reached by phone for outreach.",
          href: "/alumni?missing_phone=1",
          linkLabel: "Review alumni missing a phone number",
          /** UX-UI.md: missing-data = warning */
          tone: "warning" as const,
        },
        {
          label: "Duplicate records",
          count: dq.duplicate_count,
          description:
            "Alumni flagged as potential duplicates — review and merge candidates manually.",
          href: "/alumni?duplicate=1",
          linkLabel: "Review potential duplicate records",
          /** UX-UI.md: duplicate = danger */
          tone: "danger" as const,
        },
      ]
    : [];

  const issueTotal = alerts.reduce((sum, a) => sum + a.count, 0);

  // Coverage gauges — share of active alumni MISSING a field. Real counts only
  // (missing / total); duplicates aren't a per-alumnus "missing" measure so
  // they're surfaced as an alert, not a coverage bar.
  const total = dq?.total_alumni ?? 0;
  const pctMissing = (count: number) =>
    total > 0 ? (count / total) * 100 : 0;
  const coverage = dq
    ? [
        {
          label: "Email on file",
          missing: dq.missing_email,
          href: "/alumni?missing_email=1",
        },
        {
          label: "Employer on file",
          missing: dq.missing_employer,
          href: "/alumni?missing_employer=1",
        },
        {
          label: "Phone on file",
          missing: dq.missing_phone,
          href: "/alumni?missing_phone=1",
        },
      ]
    : [];

  return (
    <>
      <Topbar title="Data quality">
        <TopbarSearch />
      </Topbar>
      <main className="flex-1 overflow-auto p-6">
        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "Your account isn't provisioned yet"
                : error.status === 401
                  ? "Please sign in again"
                  : "Couldn't load data quality"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {error.status === 403
                ? "Ask a Super Admin to grant your account a role."
                : error.message}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                size="lg"
                label="Active alumni"
                value={dq?.total_alumni ?? "—"}
                href="/alumni"
                linkLabel="View all alumni"
              />
              <MetricCard
                size="lg"
                label="Complete alumni"
                value={dq?.complete_alumni ?? "—"}
              />
              <MetricCard
                size="lg"
                label="Missing employer"
                value={dq?.missing_employer ?? "—"}
                href="/alumni?missing_employer=1"
                linkLabel="Review alumni missing an employer"
              />
            </div>

            {/* Field coverage — visualizes the share of active alumni missing
                each key field as a bar (missing % on the right). Each row deep-
                links to that filtered alumni list for a quick fix. */}
            {dq && total > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Field coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {coverage.map((c) => {
                      const present = total - c.missing;
                      const pctPresent = 100 - pctMissing(c.missing);
                      return (
                        <li key={c.label}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium text-gray-900">
                              {c.label}
                            </span>
                            <span className="text-xs tabular-nums text-gray-500">
                              <span className="font-semibold text-gray-900">
                                {present.toLocaleString()}
                              </span>{" "}
                              / {total.toLocaleString()} ·{" "}
                              <span
                                className={
                                  c.missing > 0
                                    ? "font-semibold text-warning-600"
                                    : "font-semibold text-success-600"
                                }
                              >
                                {pctPresent.toFixed(1)}% on file
                              </span>
                            </span>
                          </div>
                          {/* Bar fills with the COVERAGE share (data on file):
                              full + green when complete, otherwise a partial
                              bar tinted warning to flag the remaining gap. */}
                          <Progress
                            value={pctPresent}
                            className="mt-2"
                            barClassName={
                              c.missing > 0
                                ? "bg-warning-600"
                                : "bg-success-600"
                            }
                            aria-label={`${c.label}: ${pctPresent.toFixed(
                              1,
                            )}% of active alumni on file`}
                          />
                          {c.missing > 0 && c.href && (
                            <div className="mt-1.5">
                              <Button asChild variant="link" size="sm">
                                <Link
                                  href={c.href}
                                  aria-label={`Review the ${c.missing.toLocaleString()} alumni missing ${c.label.toLowerCase()}`}
                                >
                                  Review {c.missing.toLocaleString()} missing
                                </Link>
                              </Button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            {issueTotal === 0 ? (
              <Card className="p-10 text-center">
                <CheckCircle2
                  className="mx-auto h-8 w-8 text-success-600"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm text-gray-500">
                  No data-quality issues flagged.
                </p>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  {/* Headline count sums EVERY alert category shown in the body
                      (missing email + missing employer + duplicates), not just
                      the first one, so it matches the rows listed below. */}
                  <CardTitle>
                    Open alerts ({issueTotal.toLocaleString()})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {alerts
                      .filter((a) => a.count > 0)
                      .map((a) => (
                        <li
                          key={a.label}
                          className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Badge variant={a.tone} className="shrink-0 tabular-nums">
                              {a.count.toLocaleString()}
                            </Badge>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-900">{a.label}</p>
                              <p className="truncate text-xs text-gray-500">
                                {a.description}
                              </p>
                            </div>
                          </div>
                          <Button asChild variant="link" size="sm">
                            <Link href={a.href} aria-label={a.linkLabel}>
                              Review
                            </Link>
                          </Button>
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
