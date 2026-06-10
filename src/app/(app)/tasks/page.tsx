import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import type { AdminTaskPage } from "@/types/tasks";
import { Topbar } from "@/components/shell/Topbar";
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
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">
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
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            {showAll
              ? "No follow-up tasks yet."
              : "No open follow-up tasks."}
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-2 md:hidden">
              {data!.items.map((t) => (
                <Link
                  key={t.follow_up_task_id}
                  href={`/alumni/${t.alumni_id}`}
                  className="block rounded-xl border border-gray-300 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium text-gray-900">
                      {t.task_title ?? "Untitled task"}
                    </p>
                    <StatusBadge completed={t.completed} />
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
            <div className="hidden overflow-hidden rounded-xl border border-gray-300 bg-white md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Alumnus</th>
                    <th className="w-32 px-4 py-3">Due</th>
                    <th className="w-24 px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((t) => (
                    <tr
                      key={t.follow_up_task_id}
                      className="border-b border-gray-300 last:border-0 hover:bg-brand-blue-50/40"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {t.task_title ?? (
                          <span className="text-gray-300">Untitled</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/alumni/${t.alumni_id}`}
                          className="font-medium text-brand-blue-600 hover:underline"
                        >
                          {t.alumni_name ?? `Alumni #${t.alumni_id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">
                        {t.due_date ? (
                          fmtDate(t.due_date)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge completed={t.completed} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {t.assigned_to ?? (
                          <span className="text-gray-300">Unassigned</span>
                        )}
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

function StatusBadge({ completed }: { completed: boolean }) {
  return completed ? (
    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      Completed
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      Open
    </span>
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
