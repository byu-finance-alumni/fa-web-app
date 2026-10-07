/**
 * Display rules for the profile History tab (#45). Pure — no network, no DOM —
 * so what a change reads as can be unit-tested. `ProfileHistory` owns the UI.
 *
 * Read-only for now: each change carries its `audit_id` so a later per-field
 * restore can act on it, but nothing here offers one.
 */
import type {
  AlumniHistoryChange,
  AlumniHistoryGroup,
} from "@/types/history";
import { fieldLabel, formatCell } from "@/lib/updateImport";

/** Saves fetched per page. */
export const HISTORY_PAGE_SIZE = 20;

/** The history request path for one record, optionally after a cursor. */
export function historyRequestPath(
  alumniId: number,
  before?: string | null,
  limit: number = HISTORY_PAGE_SIZE,
): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);
  return `/alumni/${alumniId}/history?${params.toString()}`;
}

/** What a recorded action reads as when it is not a plain field edit. */
const ACTION_LABELS: Record<string, string> = {
  create: "Record created",
  archive: "Record archived",
  restore: "Record restored",
  archive_current_role: "Current role moved to history",
  apply_survey_response: "Survey response applied",
  upload_headshot: "Photo uploaded",
  delete_headshot: "Photo removed",
  add_employment: "Past role added",
  delete_employment: "Past role removed",
  add_education: "Education added",
  delete_education: "Education removed",
  add_leadership: "Leadership added",
  update_leadership: "Leadership edited",
  delete_leadership: "Leadership removed",
  add_tag: "Tag added",
  remove_tag: "Tag removed",
  add_status_label: "Status label added",
  remove_status_label: "Status label removed",
  add_event_attendance: "Event attendance added",
  add_interaction: "Interaction logged",
  update_interaction: "Interaction edited",
  delete_interaction: "Interaction deleted",
  add_task: "Task created",
  complete_task: "Task completed",
  reopen_task: "Task reopened",
  add_note: "Note added",
  update_note: "Note edited",
  delete_note: "Note deleted",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? fieldLabel(action);
}

/** A per-field edit: show it under the FIELD's name, as `old → new`. */
function isFieldEdit(c: AlumniHistoryChange): boolean {
  return (
    !!c.field &&
    (c.action === "update" ||
      c.action === "update_employment" ||
      c.action === "update_education")
  );
}

export interface ChangeView {
  /** "Preferred first name", "Tag added", ... */
  title: string;
  /** How to show the values. `hidden` = withheld for the viewer's role. */
  kind: "diff" | "added" | "removed" | "none" | "hidden" | "old-hidden";
  old: string;
  new: string;
}

/** Decide how one change renders. */
export function describeChange(c: AlumniHistoryChange): ChangeView {
  const title = isFieldEdit(c)
    ? (c.label ?? fieldLabel((c.field ?? "").split(".").pop() ?? ""))
    : actionLabel(c.action);
  const view = { title, old: formatCell(c.old), new: formatCell(c.new) };
  // The backend withholds some values per role: everything for a non-editor,
  // and — below full_access — removed note / interaction text and the OLD text
  // of an edited one. When the new value still came back, show it and say the
  // earlier text is hidden.
  if (c.redacted) {
    return { ...view, kind: c.new != null ? "old-hidden" : "hidden" };
  }
  if (isFieldEdit(c)) return { ...view, kind: "diff" };
  if (c.old != null && c.new != null) return { ...view, kind: "diff" };
  if (c.new != null) return { ...view, kind: "added" };
  if (c.old != null) return { ...view, kind: "removed" };
  return { ...view, kind: "none" };
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual edit",
  import: "Import",
  survey: "Survey",
};

export function sourceLabel(source: AlumniHistoryGroup["source"]): string {
  return source ? (SOURCE_LABELS[source] ?? source) : "—";
}

/** "Aug 18, 2026" for the empty-state copy (date-only, no timezone shift). */
export function historyStartLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** When a save happened, in the department's timezone. */
export function historyWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
  });
}

/** Append a page, skipping any group already shown (a retried request). */
export function mergeHistoryPages(
  shown: AlumniHistoryGroup[],
  next: AlumniHistoryGroup[],
): AlumniHistoryGroup[] {
  const seen = new Set(shown.map((g) => g.group_id));
  return [...shown, ...next.filter((g) => !seen.has(g.group_id))];
}
