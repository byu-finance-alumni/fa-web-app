import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { humanize } from "@/lib/format";
import { Topbar } from "@/components/shell/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ActivityToolbar,
  type ActivityFilterState,
} from "@/components/activity/ActivityToolbar";

const LIMIT = 50;

interface ActivityRow {
  interaction_id: number;
  alumni_id: number;
  alumni_name: string;
  type: string | null;
  when: string | null;
  /** Actor display name / email (who logged the interaction). */
  by: string | null;
  by_user_id?: string | null;
}

interface ActivityPage {
  items: ActivityRow[];
  types: string[];
  total: number;
  limit: number;
  offset: number;
}

/** Combined date + compact time for the table's When column (Mountain time),
 *  e.g. "Jun 22, 2026 · 2:32p". */
function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
  const time = d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Denver",
    })
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/m$/, ""); // "2:32pm" -> "2:32p"
  return `${date} · ${time}`;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    from?: string;
    to?: string;
    sort?: string;
    mine?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  const filters: ActivityFilterState = {
    q: sp.q ?? "",
    type: sp.type ?? "",
    from: sp.from ?? "",
    to: sp.to ?? "",
    sort: sp.sort === "oldest" ? "oldest" : "recent",
    mine: sp.mine === "1",
  };

  // Forward the active filters to the API (its param names differ slightly).
  const apiParams = new URLSearchParams();
  apiParams.set("limit", String(LIMIT));
  apiParams.set("offset", String(offset));
  if (filters.q) apiParams.set("q", filters.q);
  if (filters.type) apiParams.set("type", filters.type);
  if (filters.from) apiParams.set("date_from", filters.from);
  if (filters.to) apiParams.set("date_to", filters.to);
  if (filters.sort !== "recent") apiParams.set("sort", filters.sort);
  if (filters.mine) apiParams.set("mine", "true");

  let data: ActivityPage | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<ActivityPage>(
      `/dashboard/activity?${apiParams.toString()}`,
    );
  } catch (e) {
    error =
      e instanceof ApiError ? e : new ApiError(0, "Failed to load activity.");
  }

  const hasFilters = !!(
    filters.q ||
    filters.type ||
    filters.from ||
    filters.to ||
    filters.mine
  );

  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  // Preserve all active filters in the pagination links — only the offset changes.
  const pageHref = (newOffset: number) => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.type) p.set("type", filters.type);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (filters.sort !== "recent") p.set("sort", filters.sort);
    if (filters.mine) p.set("mine", "1");
    if (newOffset > 0) p.set("offset", String(newOffset));
    const qs = p.toString();
    return qs ? `/activity?${qs}` : "/activity";
  };

  return (
    <>
      <Topbar title="Activity" />
      <main className="flex-1 overflow-auto p-6">
        {/* KPI strip on top — counts straight off the feed response (no
            fabricated metrics): total matching interactions, how many are on
            this page, and the number of distinct types. */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label={hasFilters ? "Matching interactions" : "Total interactions"}
            value={data ? data.total.toLocaleString() : "—"}
          />
          <StatCard
            label="Shown on this page"
            value={data ? data.items.length.toLocaleString() : "—"}
          />
          <StatCard
            label="Interaction types"
            value={data ? data.types.length.toLocaleString() : "—"}
          />
        </div>

        {/* Search + filter bar */}
        <ActivityToolbar initial={filters} types={data?.types ?? []} />

        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "Your account isn't provisioned yet"
                : error.status === 401
                  ? "Please sign in again"
                  : "Couldn't load activity"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {error.status === 403
                ? "Ask a Super Admin to grant your account a role."
                : error.message}
            </p>
          </Card>
        ) : data && data.items.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            {hasFilters
              ? "No interactions match your filters."
              : "No interactions logged yet."}
          </Card>
        ) : (
          <>
            {/* Interaction log as a table — When / Alumnus / Type / Logged by. */}
            <Card className="overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2.5">When</th>
                    <th className="px-4 py-2.5">Alumnus</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Logged by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data!.items.map((r) => (
                    <tr key={r.interaction_id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-gray-500">
                        {fmtWhen(r.when)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/alumni/${r.alumni_id}`}
                          className="font-medium text-brand-blue-600 hover:underline"
                        >
                          {r.alumni_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.type ? (
                          <Badge variant="neutral">{humanize(r.type)}</Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {r.by ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span className="tabular-nums">
                Showing {from}–{to} of {data!.total}
              </span>
              <div className="flex gap-2">
                <PageLink
                  href={pageHref(offset - LIMIT)}
                  enabled={hasPrev}
                  label="‹ Prev"
                />
                <PageLink
                  href={pageHref(offset + LIMIT)}
                  enabled={hasNext}
                  label="Next ›"
                />
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">
        {value}
      </p>
    </Card>
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
    <Button asChild variant="secondary" size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  ) : (
    <Button variant="secondary" size="sm" disabled>
      {label}
    </Button>
  );
}
