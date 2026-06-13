import Link from "next/link";
import { Mail, Briefcase, Copy, CheckCircle2 } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { MetricCard } from "@/components/shared/MetricCard";

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
          icon: Mail,
          label: "Missing email",
          count: dq.missing_email,
          description:
            "Active alumni with no personal or work email on file — can't be reached for outreach.",
          href: "/alumni?missing_email=1",
          linkLabel: "Review alumni missing an email",
          /** UX-UI.md: missing-data = warning-600 */
          iconBg: "bg-warning-600",
        },
        {
          icon: Briefcase,
          label: "Missing employer",
          count: dq.missing_employer,
          description:
            "Active alumni with no current employer recorded — career data needs enrichment.",
          href: "/alumni?missing_employer=1",
          linkLabel: "Review alumni missing an employer",
          /** UX-UI.md: missing-data = warning-600 */
          iconBg: "bg-warning-600",
        },
        {
          icon: Copy,
          label: "Duplicate records",
          count: dq.duplicate_count,
          description:
            "Alumni flagged as potential duplicates — review and merge candidates manually.",
          href: "/alumni?duplicate=1",
          linkLabel: "Review potential duplicate records",
          /** UX-UI.md: duplicate = danger-600 */
          iconBg: "bg-danger-600",
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
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">
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
          </div>
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
              <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
                <CheckCircle2
                  className="mx-auto h-8 w-8 text-success-600"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm text-gray-500">
                  No data-quality issues flagged.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-300 bg-white p-5">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  Open alerts
                </h3>
                <ul className="space-y-2">
                  {alerts
                    .filter((a) => a.count > 0)
                    .map((a) => (
                      <li
                        key={a.label}
                        className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${a.iconBg} text-white`}>
                            <a.icon className="h-3 w-3" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900">
                              {a.count.toLocaleString()} · {a.label}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {a.description}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={a.href}
                          className="shrink-0 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
                        >
                          Review
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
