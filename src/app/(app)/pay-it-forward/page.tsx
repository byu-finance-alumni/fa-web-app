import Link from "next/link";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/MetricCard";
import { apiGet, ApiError } from "@/lib/api";
import { hasFullAccess, isUserAdmin } from "@/constants/roles";
import type { UserContext } from "@/types/alumni";
import type { Donor, DonorsResponse, DonationsSummary } from "@/types/donations";
import { DonorTable } from "@/components/donations/DonorTable";
import { QuickAddDonation } from "@/components/donations/QuickAddDonation";

/** Format a money value, or a dash when it's withheld (null = not authorized). */
function money(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Render a metric value, dimmed when the dollar figure is withheld. */
function amountValue(text: string, showAmounts: boolean) {
  return showAmounts ? text : <span className="text-gray-400">{text}</span>;
}

/**
 * Pay It Forward Fund tab (#161). The donor ledger requires the full_access tier
 * to read (#278) — the backend 403s student / view_only ("Professor"), and the
 * sidebar hides the nav for them. Dollar AMOUNTS are additionally gated to
 * full_access+ (the backend nulls them otherwise, so `null` renders as "—").
 * Add-donation and CSV import are admin-tier (super_admin+) via `canManage`. The
 * backend re-enforces every gate.
 */
export default async function PayItForwardPage() {
  let showAmounts = false;
  let canManage = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    showAmounts = hasFullAccess(ctx.roles);
    canManage = isUserAdmin(ctx.roles);
  } catch {
    showAmounts = false;
    canManage = false;
  }

  let donors: Donor[] = [];
  let summary: DonationsSummary | null = null;
  let error: ApiError | null = null;
  const [donorsRes, summaryRes] = await Promise.allSettled([
    // GET /donations/donors now returns a paginated envelope
    // ({ items, total, limit, offset }), not a bare array (#173 follow-up).
    // We show the full list here (no pagination UI yet), so pull the default
    // first page and read `items`. Guard against a non-array `items` so a shape
    // regression degrades to "no donors" instead of a render crash.
    apiGet<DonorsResponse>("/donations/donors"),
    apiGet<DonationsSummary>("/donations/summary"),
  ]);
  if (donorsRes.status === "fulfilled")
    donors = Array.isArray(donorsRes.value.items) ? donorsRes.value.items : [];
  else {
    const e = donorsRes.reason;
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load donors.");
  }
  if (summaryRes.status === "fulfilled") summary = summaryRes.value;

  const thisYear = summary?.per_year[0];

  return (
    <>
      <Topbar title="Pay It Forward" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Page header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">
                Pay It Forward Fund
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Alumni giving back to the finance program. Every role can see who
                gave and when; dollar figures are reserved for full-access staff.
              </p>
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-2">
                <QuickAddDonation />
                <Button asChild variant="secondary">
                  <Link href="/pay-it-forward/import">Import CSV</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Fund summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label="Donors" value={summary?.donor_count ?? 0} />
            <MetricCard
              label="Donations"
              value={summary?.donation_count ?? 0}
            />
            <MetricCard
              label="Total raised"
              value={amountValue(
                summary ? money(summary.total_raised) : "—",
                showAmounts,
              )}
            />
            <MetricCard
              label={thisYear ? `This year (${thisYear.year})` : "This year"}
              value={amountValue(
                summary
                  ? money(thisYear?.total ?? (showAmounts ? 0 : null))
                  : "—",
                showAmounts,
              )}
            />
          </div>

          {!showAmounts && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">
              Donation amounts are restricted. You can see who gave and when, but
              dollar figures are visible to full-access staff only.
            </p>
          )}

          {/* Donor ledger */}
          {error ? (
            <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-sm font-semibold text-gray-900">
                {error.status === 403
                  ? "You don't have access to the Pay It Forward fund"
                  : "Couldn't load donors"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                {error.status === 403
                  ? "The donor ledger is available to full-access staff. Ask an administrator if you need access."
                  : error.message}
              </p>
            </Card>
          ) : donors.length === 0 ? (
            <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-sm font-semibold text-gray-900">
                No donations recorded yet
              </p>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                {canManage
                  ? "Use Add donation to log a single gift, or Import CSV to bulk-load from a spreadsheet."
                  : "Gifts will appear here once they're recorded."}
              </p>
            </Card>
          ) : (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Donors</h2>
                <span className="text-xs tabular-nums text-gray-500">
                  {donors.length} shown
                </span>
              </div>
              <DonorTable donors={donors} showAmounts={showAmounts} />
            </section>
          )}
        </div>
      </main>
    </>
  );
}
