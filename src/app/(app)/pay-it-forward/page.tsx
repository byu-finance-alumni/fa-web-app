import Link from "next/link";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

/**
 * Pay It Forward Fund tab (#161). Donor identity, the years each gave, and the
 * donor count are visible to every role; dollar AMOUNTS are shown only to
 * full_access+ (the backend nulls them otherwise, so `null` renders as "—").
 * Super admins get the quick-add and CSV import entry points. The backend
 * re-enforces every gate.
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

  return (
    <>
      <Topbar title="Pay It Forward" />
      <main className="flex-1 overflow-auto p-6">
        {/* Summary + actions */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Donors" value={String(summary?.donor_count ?? 0)} />
            <StatCard
              label="Donations"
              value={String(summary?.donation_count ?? 0)}
            />
            <StatCard
              label="Total raised"
              value={summary ? money(summary.total_raised) : "—"}
              muted={!showAmounts}
            />
            <StatCard
              label="This year"
              value={
                summary
                  ? money(summary.per_year[0]?.total ?? (showAmounts ? 0 : null))
                  : "—"
              }
              hint={summary?.per_year[0] ? String(summary.per_year[0].year) : undefined}
              muted={!showAmounts}
            />
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

        {!showAmounts && (
          <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">
            Donation amounts are restricted. You can see who gave and when, but
            dollar figures are visible to full-access staff only.
          </p>
        )}

        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "Your account isn't provisioned yet"
                : "Couldn't load donors"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </Card>
        ) : donors.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            No donations recorded yet.
            {canManage ? " Use Add donation or Import CSV to get started." : ""}
          </Card>
        ) : (
          <DonorTable donors={donors} showAmounts={showAmounts} />
        )}
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <Card className="p-4">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
        {hint ? <span className="ml-1 normal-case text-gray-400">({hint})</span> : null}
      </span>
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${
          muted ? "text-gray-400" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
