import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { humanize } from "@/lib/format";
import { Topbar } from "@/components/shell/Topbar";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
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
  /** Actor's user id; may be null. Read directly off the untyped response. */
  by_user_id?: string | null;
}

interface ActivityPage {
  items: ActivityRow[];
  types: string[];
  total: number;
  limit: number;
  offset: number;
}

const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

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
        <ActivityToolbar initial={filters} types={data?.types ?? []} />

        {error ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">
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
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            {filters.q ||
            filters.type ||
            filters.from ||
            filters.to ||
            filters.mine
              ? "No interactions match your filters."
              : "No interactions logged yet."}
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards (dense tables collapse to cards per UX-UI.md). */}
            <div className="space-y-2 md:hidden">
              {data!.items.map((r) => (
                <div
                  key={r.interaction_id}
                  className="rounded-xl border border-gray-300 bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/alumni/${r.alumni_id}`}
                      className="font-medium text-gray-900 hover:text-brand-blue-600"
                    >
                      {r.alumni_name}
                    </Link>
                    {r.type ? (
                      <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {humanize(r.type)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {fmtDateTime(r.when)}
                    {r.by ? ` · ${r.by}` : ""}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-300 bg-white md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="w-56 px-4 py-3">Edited by</th>
                    <th className="w-52 px-4 py-3">Date / time</th>
                    <th className="w-44 px-4 py-3">Action</th>
                    <th className="px-4 py-3">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((r) => (
                    <tr
                      key={r.interaction_id}
                      className="border-b border-gray-300 last:border-0 hover:bg-brand-blue-50/40"
                    >
                      <td className="px-4 py-3">
                        {r.by ? (
                          <div className="flex items-center gap-2.5">
                            <InitialsAvatar name={r.by} size="sm" />
                            <span className="text-gray-700">{r.by}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">
                        {fmtDateTime(r.when)}
                      </td>
                      <td className="px-4 py-3">
                        {r.type ? (
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {humanize(r.type)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/alumni/${r.alumni_id}`}
                          className="font-medium text-brand-blue-600 hover:underline"
                        >
                          {r.alumni_name}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span>
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

function PageLink({
  href,
  enabled,
  label,
}: {
  href: string;
  enabled: boolean;
  label: string;
}) {
  const cls =
    "rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium";
  return enabled ? (
    <Link href={href} className={`${cls} bg-white text-gray-700 hover:bg-gray-50`}>
      {label}
    </Link>
  ) : (
    <span className={`${cls} bg-gray-50 text-gray-300`}>{label}</span>
  );
}
