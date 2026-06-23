"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";

/** Sort options, mirrored 1:1 with the backend GET /tasks ``sort`` param. */
export type TaskSort = "due" | "due_desc" | "alumni" | "created" | "status";

const SORTS: { value: TaskSort; label: string }[] = [
  { value: "due", label: "Sort: Due date" },
  { value: "alumni", label: "Sort: Alumni (A–Z)" },
  { value: "created", label: "Sort: Newest" },
  { value: "status", label: "Sort: Status" },
];

/** Everything the Tasks list mirrors into the URL. */
export interface TaskFilterState {
  q: string;
  /** "" = open only (default), "all" = include completed. */
  status: "" | "all";
  overdue: boolean;
  /** "" = any, "unassigned", or a user-id string. */
  assignee: string;
  sort: TaskSort;
}

export const EMPTY_TASK_FILTERS: TaskFilterState = {
  q: "",
  status: "",
  overdue: false,
  assignee: "",
  sort: "due",
};

/** Serialize filter state to the canonical /tasks query string (no offset). */
function toQs(f: TaskFilterState): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.status === "all") p.set("status", "all");
  if (f.overdue) p.set("overdue", "1");
  if (f.assignee) p.set("assignee", f.assignee);
  if (f.sort && f.sort !== "due") p.set("sort", f.sort);
  return p.toString();
}

/**
 * Toolbar for the admin Tasks list: live search on the left, then the Open/All
 * toggle, an Overdue toggle, an Assignee dropdown, and a Sort dropdown. Mirrors
 * AlumniFilters — every change navigates (debounced) and the server refetches;
 * there is no Apply button. State lives in the URL so it survives pagination and
 * is the single source of truth. Changing any filter resets to the first page
 * (the serialized query string carries no offset).
 */
export function TaskFilters({
  initial,
  assignees,
}: {
  initial: TaskFilterState;
  /** Distinct assignees present in the data, for the dropdown. */
  assignees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [f, setF] = useState<TaskFilterState>(initial);
  const [isPending, startTransition] = useTransition();
  const lastPushedRef = useRef(toQs(initial));

  const serialized = toQs(f);
  const initialQs = toQs(initial);

  // Live navigation: search filters as you type (debounced); toggles like Overdue
  // apply immediately. replace() (not push) so each keystroke/toggle doesn't stack
  // a history entry — Back returns to the previous page rather than stepping back
  // through filter states. Clearing navigates at once without the debounce.
  useEffect(() => {
    if (serialized === lastPushedRef.current) return;
    const navigate = () => {
      lastPushedRef.current = serialized;
      startTransition(() => {
        router.replace(serialized ? `/tasks?${serialized}` : "/tasks");
      });
    };
    if (serialized === "") {
      navigate();
      return;
    }
    const timer = setTimeout(navigate, 300);
    return () => clearTimeout(timer);
  }, [serialized, router]);

  // Re-seed when the URL changed from outside (e.g. Prev/Next pagination).
  useEffect(() => {
    if (initialQs !== lastPushedRef.current) {
      lastPushedRef.current = initialQs;
      setF(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQs]);

  const set = <K extends keyof TaskFilterState>(
    key: K,
    value: TaskFilterState[K],
  ) => setF((prev) => ({ ...prev, [key]: value }));

  // Keep a deep-linked / data-derived assignee selectable even if it isn't in
  // the current assignees list.
  const assigneeInList =
    !f.assignee ||
    f.assignee === "unassigned" ||
    assignees.some((a) => a.id === f.assignee);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-3">
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-brand-blue-600 focus-within:ring-1 focus-within:ring-brand-blue-600">
        <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <input
          value={f.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search task or alumnus"
          aria-label="Search tasks"
          className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
        />
        {isPending && (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-gray-500"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Open / All toggle. */}
      <div className="inline-flex shrink-0 rounded-lg border border-gray-300 bg-white p-0.5 text-sm">
        <button
          type="button"
          onClick={() => set("status", "")}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            f.status === ""
              ? "bg-brand-blue-600 text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => set("status", "all")}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            f.status === "all"
              ? "bg-brand-blue-600 text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          All
        </button>
      </div>

      {/* Overdue toggle. */}
      <button
        type="button"
        onClick={() => set("overdue", !f.overdue)}
        aria-pressed={f.overdue}
        className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
          f.overdue
            ? "border-brand-blue-600 bg-brand-blue-600 text-white"
            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        Overdue
      </button>

      {/* Assignee dropdown. */}
      <div className="relative shrink-0">
        <select
          value={f.assignee}
          onChange={(e) => set("assignee", e.target.value)}
          aria-label="Filter by assignee"
          className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none"
          style={{ colorScheme: "light" }}
        >
          <option value="">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
          {!assigneeInList && <option value={f.assignee}>{f.assignee}</option>}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
      </div>

      {/* Sort dropdown. */}
      <div className="relative shrink-0">
        <select
          value={f.sort}
          onChange={(e) => set("sort", e.target.value as TaskSort)}
          aria-label="Sort tasks"
          className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none"
          style={{ colorScheme: "light" }}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
