import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/MetricCard";
import type { AlumniDonations } from "@/types/donations";
import { DeleteDonationButton } from "@/components/donations/DeleteDonationButton";

const MONTHS = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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
 * Pay It Forward panel for an alumni profile (#161). Shows lifetime giving and a
 * per-year breakdown of this alumnus's gifts. Dollar amounts come pre-gated from
 * the backend (`null` for callers without amount-view permission), so they
 * render as "—" for non-full-access users while the years/counts stay visible.
 * Rendered only when the alumnus actually has donations.
 */
export function AlumniPayItForwardPanel({
  data,
  canDelete = false,
}: {
  data: AlumniDonations;
  /** Admin tier (full_access+) — shows the per-gift delete control (H4). */
  canDelete?: boolean;
}) {
  // Amounts are withheld uniformly by the backend; lifetime_total === null is
  // the signal that this caller may not see dollar figures.
  const showAmounts = data.lifetime_total !== null;

  // Roll the gift list up per year (newest first).
  const byYear = new Map<number, { count: number; total: number | null }>();
  for (const d of data.donations) {
    const cur = byYear.get(d.year) ?? { count: 0, total: showAmounts ? 0 : null };
    cur.count += 1;
    if (showAmounts && d.amount != null) cur.total = (cur.total ?? 0) + d.amount;
    byYear.set(d.year, cur);
  }
  const years = [...byYear.entries()].sort((a, b) => b[0] - a[0]);
  // #220: surface the latest year a gift was given (max year) and how many
  // gifts in total, replacing the old "Years given" (distinct-year count).
  const mostRecentYear = years.length ? years[0][0] : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Lifetime giving"
          value={
            showAmounts ? (
              money(data.lifetime_total)
            ) : (
              <span className="text-gray-400">{money(data.lifetime_total)}</span>
            )
          }
        />
        <MetricCard label="Most recent year" value={mostRecentYear ?? "—"} />
        <MetricCard label="Times given" value={data.donation_count} />
      </div>

      {!showAmounts && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Donation amounts are restricted to full-access staff. You can see when
          this alumnus gave, but not the dollar figures.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2.5">Year</th>
              <th className="px-4 py-2.5 text-right">Gifts</th>
              <th className="px-4 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {years.map(([year, row]) => (
              <tr key={year}>
                <td className="px-4 py-2.5 font-medium text-gray-900">{year}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                  {row.count}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${
                    showAmounts ? "font-semibold text-gray-900" : "text-gray-400"
                  }`}
                >
                  {money(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Per-gift detail (month + amount) — months add context; amounts gated. */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Gift history</h3>
        <ul className="divide-y divide-gray-100">
          {data.donations.map((d) => {
            const when = `${d.month ? `${MONTHS[d.month]} ` : ""}${d.year}`;
            return (
              <li
                key={d.donation_id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="text-sm text-gray-700">{when}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm tabular-nums ${
                      showAmounts
                        ? "font-semibold text-gray-900"
                        : "text-gray-400"
                    }`}
                  >
                    {money(d.amount)}
                  </span>
                  {canDelete ? (
                    <DeleteDonationButton
                      donationId={d.donation_id}
                      label={when}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <Link
          href="/pay-it-forward"
          className="mt-3 inline-block text-xs font-semibold text-brand-blue-600 hover:underline"
        >
          View the Pay It Forward Fund
        </Link>
      </Card>
    </div>
  );
}
