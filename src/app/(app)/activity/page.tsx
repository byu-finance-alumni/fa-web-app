import Link from "next/link";
import {
  Activity as ActivityIcon,
  Calendar,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";
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

/**
 * Map an interaction type to a Lucide icon. Matching is loose (substring,
 * case-insensitive) so backend label variants ("Phone call", "phone_call",
 * "Call") all resolve. Falls back to a generic activity glyph so every row
 * carries a leading icon.
 */
function iconForType(type: string | null): LucideIcon {
  const t = (type ?? "").toLowerCase();
  if (t.includes("phone") || t.includes("call")) return Phone;
  if (t.includes("meet") || t.includes("visit")) return Users;
  if (t.includes("email") || t.includes("mail")) return Mail;
  if (t.includes("event")) return Calendar;
  if (t.includes("note")) return StickyNote;
  if (t.includes("text") || t.includes("sms") || t.includes("message"))
    return MessageSquare;
  if (t.includes("linkedin") || t.includes("social")) return FileText;
  return ActivityIcon;
}

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

/** A run of log rows that share one calendar day (Mountain time). */
interface DayGroup {
  key: string;
  label: string;
  rows: ActivityRow[];
}

/** Start-of-day in local time, for whole-day difference math. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Compact time-of-day for the left rail, e.g. "2:32p" / "11:05a". */
function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const s = d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Denver",
    })
    .toLowerCase()
    .replace(/\s/g, "");
  // "2:32pm" -> "2:32p" to keep the rail tight.
  return s.replace(/m$/, "");
}

/** Day-group header label: "Today" / "Yesterday" / "Jun 22, 2026". */
function fmtDayLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Stable per-day key (local calendar date) so rows bucket correctly. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Bucket the already-sorted rows into consecutive day groups, preserving the
 * server's ordering (newest- or oldest-first). Rows without a timestamp fall
 * into a trailing "Undated" group.
 */
function groupByDay(rows: ActivityRow[]): DayGroup[] {
  const groups: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const r of rows) {
    const key = r.when ? dayKey(r.when) : "undated";
    if (!current || current.key !== key) {
      current = {
        key,
        label: r.when ? fmtDayLabel(r.when) : "Undated",
        rows: [],
      };
      groups.push(current);
    }
    current.rows.push(r);
  }
  return groups;
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

  const groups = data ? groupByDay(data.items) : [];

  return (
    <>
      <Topbar title="Activity" />
      <main className="flex-1 overflow-auto p-6">
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
            {filters.q ||
            filters.type ||
            filters.from ||
            filters.to ||
            filters.mine
              ? "No interactions match your filters."
              : "No interactions logged yet."}
          </Card>
        ) : (
          <>
            {/* Summary stats — only counts already present in the feed response
                (no fabricated "calls this month"): total matching interactions,
                how many are on this page, and the number of distinct types. */}
            <div className="mx-auto mb-4 grid max-w-3xl grid-cols-3 gap-3">
              <Card className="px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {filters.q ||
                  filters.type ||
                  filters.from ||
                  filters.to ||
                  filters.mine
                    ? "Matching interactions"
                    : "Total interactions"}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
                  {data!.total.toLocaleString()}
                </p>
              </Card>
              <Card className="px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Shown on this page
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
                  {data!.items.length.toLocaleString()}
                </p>
              </Card>
              <Card className="px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Interaction types
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
                  {data!.types.length.toLocaleString()}
                </p>
              </Card>
            </div>

            {/* Chronological log feed — grouped by day, newest first within a
                group (server-sorted). A fixed left rail holds the time so every
                line aligns; the alumnus, action chip, and muted actor read as a
                single scannable row rather than a data grid. */}
            <Card className="mx-auto max-w-3xl overflow-hidden">
              {groups.map((g) => (
                <section key={g.key}>
                  <h2 className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {g.label}
                  </h2>
                  <ul>
                    {g.rows.map((r) => {
                      const TypeIcon = iconForType(r.type);
                      return (
                      <li
                        key={r.interaction_id}
                        className="flex items-baseline gap-3 border-b border-gray-200 px-4 py-2.5 last:border-0 hover:bg-brand-blue-50/40"
                      >
                        <time className="w-14 shrink-0 text-xs tabular-nums text-gray-500">
                          {fmtTime(r.when)}
                        </time>
                        <TypeIcon
                          className="mt-0.5 h-4 w-4 shrink-0 self-start text-gray-400"
                          aria-hidden="true"
                        />
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
                          <Link
                            href={`/alumni/${r.alumni_id}`}
                            className="truncate text-sm font-medium text-gray-900 hover:text-brand-blue-600"
                          >
                            {r.alumni_name}
                          </Link>
                          {r.type ? (
                            <Badge variant="neutral">{humanize(r.type)}</Badge>
                          ) : null}
                        </div>
                        {r.by ? (
                          <span className="shrink-0 truncate text-xs text-gray-500">
                            by {r.by}
                          </span>
                        ) : null}
                      </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </Card>

            <div className="mx-auto mt-3 flex max-w-3xl items-center justify-between text-sm text-gray-500">
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
