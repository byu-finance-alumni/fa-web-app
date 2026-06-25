import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { MetricCard } from "@/components/shared/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataQuality {
  total_alumni: number;
  missing_email: number;
  missing_employer: number;
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
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <MetricCard
                size="lg"
                label="Active alumni"
                value={dq?.total_alumni ?? "—"}
                href="/alumni"
                linkLabel="View all alumni"
              />
              {alerts.map((a) => (
                <MetricCard
                  key={a.label}
                  size="lg"
                  label={a.label}
                  value={a.count}
                  href={a.href}
                  linkLabel={a.linkLabel}
                />
              ))}
            </div>

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
                  <CardTitle>Open alerts</CardTitle>
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
