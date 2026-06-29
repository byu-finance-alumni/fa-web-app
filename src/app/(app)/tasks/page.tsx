import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import type { AdminTaskPage } from "@/types/tasks";
import { Topbar } from "@/components/shell/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  TaskFilters,
  type TaskFilterState,
  type TaskSort,
} from "@/components/tasks/TaskFilters";

const LIMIT = 50;

const SORTS: TaskSort[] = ["due", "due_desc", "alumni", "created", "status"];

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

/** Today as YYYY-MM-DD (local) for whole-day overdue comparison. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** A task is overdue when it's still open and its due date is before today. */
function isOverdue(
  task: { completed: boolean; due_date: string | null },
  today: string,
): boolean {
  return !task.completed && task.due_date != null && task.due_date < today;
}

type SP = {
  q?: string;
  status?: string;
  overdue?: string;
  assignee?: string;
  sort?: string;
  offset?: string;
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  // Normalize the URL into one filter model (mirrors AlumniFilters).
  const filters: TaskFilterState = {
    q: sp.q ?? "",
    // Default view shows open tasks only; "all" includes completed ones.
    status: sp.status === "all" ? "all" : "",
    overdue: sp.overdue === "1",
    assignee: sp.assignee ?? "",
    sort: (SORTS.includes(sp.sort as TaskSort)
      ? (sp.sort as TaskSort)
      : "due") as TaskSort,
  };
  const showAll = filters.status === "all";

  const apiParams = new URLSearchParams();
  apiParams.set("limit", String(LIMIT));
  apiParams.set("offset", String(offset));
  if (showAll) apiParams.set("all", "true");
  if (filters.q) apiParams.set("q", filters.q);
  if (filters.overdue) apiParams.set("overdue", "true");
  if (filters.assignee) apiParams.set("assignee", filters.assignee);
  if (filters.sort !== "due") apiParams.set("sort", filters.sort);

  let data: AdminTaskPage | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<AdminTaskPage>(`/tasks?${apiParams.toString()}`);
  } catch (e) {
    error =
      e instanceof ApiError ? e : new ApiError(0, "Failed to load tasks.");
  }

  // Assignee options come from the assignees present on the current page —
  // enough for a useful dropdown without a separate endpoint. Deduped by id;
  // a selected-but-absent value stays selectable via TaskFilters.
  const assigneeMap = new Map<string, string>();
  for (const t of data?.items ?? []) {
    if (t.assigned_to_user_id != null && t.assigned_to) {
      assigneeMap.set(String(t.assigned_to_user_id), t.assigned_to);
    }
  }
  const assignees = Array.from(assigneeMap, ([id, name]) => ({ id, name })).sort(
    (a, b) => a.name.localeCompare(b.name),
  );

  const today = todayIso();
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  const pageHref = (newOffset: number) => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (showAll) p.set("status", "all");
    if (filters.overdue) p.set("overdue", "1");
    if (filters.assignee) p.set("assignee", filters.assignee);
    if (filters.sort !== "due") p.set("sort", filters.sort);
    if (newOffset > 0) p.set("offset", String(newOffset));
    const qs = p.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  };

  return (
    <>
      <Topbar title="Tasks" />
      <main className="flex-1 overflow-auto p-6">
        <TaskFilters initial={filters} assignees={assignees} />

        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "You don't have access to Tasks"
                : error.status === 401
                  ? "Please sign in again"
                  : "Couldn't load tasks"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {error.status === 403
                ? "The cross-alumni task list is available to full-access users only."
                : error.message}
            </p>
          </Card>
        ) : data && data.items.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            {showAll
              ? "No follow-up tasks yet."
              : "No open follow-up tasks."}
          </Card>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-2 md:hidden">
              {data!.items.map((t) => (
                <Link
                  key={t.follow_up_task_id}
                  href={`/alumni/${t.alumni_id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-3 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                      {t.task_title ?? "Untitled task"}
                    </p>
                    <StatusBadge
                      completed={t.completed}
                      overdue={isOverdue(t, today)}
                    />
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {t.alumni_name ?? `Alumni #${t.alumni_id}`}
                    {" · "}
                    {t.due_date ? `Due ${fmtDate(t.due_date)}` : "No due date"}
                    {t.assigned_to ? ` · ${t.assigned_to}` : ""}
                  </p>
                </Link>
              ))}
            </div>

            {/* Desktop: dense table */}
            <Card className="hidden overflow-hidden p-0 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2.5">Task</th>
                    <th className="px-4 py-2.5">Alumnus</th>
                    <th className="w-32 px-4 py-2.5">Due</th>
                    <th className="w-24 px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((t) => {
                    const overdue = isOverdue(t, today);
                    return (
                    <tr
                      key={t.follow_up_task_id}
                      className="border-b border-gray-200 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {t.task_title ?? (
                          <span className="text-gray-400">Untitled</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/alumni/${t.alumni_id}`}
                          className="font-medium text-brand-blue-600 hover:underline"
                        >
                          {t.alumni_name ?? `Alumni #${t.alumni_id}`}
                        </Link>
                      </td>
                      <td
                        className={
                          overdue
                            ? "px-4 py-2.5 font-medium tabular-nums text-danger-600"
                            : "px-4 py-2.5 tabular-nums text-gray-700"
                        }
                      >
                        {t.due_date ? (
                          fmtDate(t.due_date)
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge completed={t.completed} overdue={overdue} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {t.assigned_to ?? (
                          <span className="text-gray-400">Unassigned</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

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

/**
 * Color-coded task status: done → success (green), overdue → danger (red),
 * open → neutral (gray). Overdue is derived (open + past due date) since the
 * backend exposes no explicit overdue flag on the item.
 */
function StatusBadge({
  completed,
  overdue,
}: {
  completed: boolean;
  overdue: boolean;
}) {
  if (completed) return <Badge variant="success">Completed</Badge>;
  if (overdue) return <Badge variant="danger">Overdue</Badge>;
  return <Badge variant="neutral">Open</Badge>;
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
    <Button variant="secondary" size="sm" disabled aria-disabled>
      {label}
    </Button>
  );
}
