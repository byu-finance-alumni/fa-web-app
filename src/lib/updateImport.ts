/**
 * Rules and small helpers for the bulk alumni UPDATE import (#610).
 *
 * The update path takes a CSV, matches each row to an existing profile by Net
 * ID (BYU ID wins if both are present), and shows a per-field `old -> new` diff
 * BEFORE anything is written. Nothing here talks to the network or the DOM —
 * `UpdateImportWizard` owns the UI and the server actions — so the parts that
 * decide what the operator is shown, and whether the Apply button is even
 * reachable, can be unit-tested.
 *
 * The backend re-enforces every rule below. These exist so the operator gets an
 * immediate, specific answer instead of a wall of header errors.
 */

import type {
  UpdateImportManualEditWarning,
  UpdateImportPreview,
  UpdateImportRowReport,
} from "@/types/alumni";

/** File types the CSV picker accepts (the backend re-checks the content). */
export const CSV_ACCEPT_ATTR = ".csv,text/csv";

/** True if a picked file looks like a CSV — extension or the MIME types Excel
 *  and the OS actually attach (Windows tags .csv as an Excel type). */
export const isCsvFile = (file: File): boolean =>
  file.name.toLowerCase().endsWith(".csv") ||
  file.type === "text/csv" ||
  file.type === "application/vnd.ms-excel";

/** Pretty-print a before/after cell value for a change diff. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** snake_case field name → a readable label ("current_employer" → "Current
 *  employer"). */
export function fieldLabel(field: string): string {
  const spaced = field.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : field;
}

/**
 * Split a preview's rows into the three groups the review step renders.
 *
 * `unmatched` deliberately folds in `unmatched_archived` — from the operator's
 * side both mean "this Net ID did not land on a profile we will update", and
 * the per-row `message` says which. Rows that matched but differ in nothing
 * (`no_changes`) appear in none of the three: they are counted in the summary
 * and otherwise not worth screen space.
 */
export function partitionPreviewRows(rows: UpdateImportRowReport[]): {
  changed: UpdateImportRowReport[];
  unmatched: UpdateImportRowReport[];
  errored: UpdateImportRowReport[];
} {
  return {
    changed: rows.filter((r) => r.status === "update"),
    unmatched: rows.filter(
      (r) => r.status === "unmatched" || r.status === "unmatched_archived",
    ),
    errored: rows.filter((r) => r.status === "error"),
  };
}

/**
 * What the review step may offer, from the preview alone.
 *
 * The invariant this exists to hold: `canApply` is the ONLY thing that enables
 * the Apply button, and it is false unless the header row was usable AND the
 * dry-run found at least one profile that would actually change. A file that
 * matches everyone and changes nothing must not be appliable — there is nothing
 * to confirm, and offering the button invites a pointless bulk write.
 */
export function previewGate(preview: UpdateImportPreview): {
  /** The header row was usable — rows were evaluated. */
  headersOk: boolean;
  /** Matched fine, but every value in the file is already stored. */
  nothingToDo: boolean;
  /** Enable the Apply button. */
  canApply: boolean;
} {
  const headersOk = preview.columns_ok;
  const withChanges = preview.summary.with_changes;
  return {
    headersOk,
    nothingToDo: headersOk && withChanges === 0,
    canApply: headersOk && withChanges > 0,
  };
}

/**
 * Columns in the uploaded file that map to nothing we store.
 *
 * They are skipped rather than fatal (#610) — a spreadsheet staff keep for
 * their own bookkeeping should not block an otherwise-good update. The catch is
 * that a MISTYPED column header lands here too and would otherwise vanish
 * without a word, so the review step names every one of them before the
 * operator confirms. Always render this when it is non-empty.
 */
export const ignoredColumns = (preview: UpdateImportPreview): string[] =>
  preview.ignored_columns ?? [];

/* ------------------------------------ overwriting a recent hand edit (#420) --- */

/**
 * What the review step needs to warn about rows that would revert a RECENT
 * manual correction (#420).
 *
 * The failure this exists for: a staffer fixes an employer in the profile
 * editor, a colleague uploads a week-old cohort export, and the correction is
 * gone — shown in the preview as an ordinary field change, indistinguishable
 * from a real one. The backend flags a row when it would change at least one
 * field AND the record was hand-edited in the last 30 days.
 *
 * Jake's call is WARN, NOT BLOCK: the commit still applies every row, there is
 * no confirmation step, no per-row opt-out, and `previewGate` is untouched.
 * `show` is false at zero — a banner that appears on every import is one people
 * learn to dismiss, which would defeat the point.
 */
export interface ManualEditAlert {
  /** The flagged rows, in file order — the ones worth opening and checking. */
  rows: UpdateImportRowReport[];
  /** How many rows are flagged. */
  count: number;
  /** Rows in the file, for the "N of M" headline. */
  total: number;
  /** Render the alert at all. */
  show: boolean;
}

export function manualEditAlert(preview: UpdateImportPreview): ManualEditAlert {
  const rows = preview.rows.filter((r) => r.overwrites_manual_edit != null);
  // The summary count is the number the operator is told; the row list is what
  // we can actually name. Both come from the same dry run and agree — the
  // fallback only covers a payload from before the summary field existed.
  const count = preview.summary.overwrites_manual_edit ?? rows.length;
  return { rows, count, total: preview.summary.total, show: count > 0 };
}

/**
 * The alert's headline sentence — the number first, in plain words.
 *
 * "rows" agrees with the file total ("1 of 2,000 rows"), while "a change" vs
 * "changes" agrees with the flagged count, so a single flagged row doesn't read
 * as if several people were overwritten.
 */
export function manualEditHeadline(alert: ManualEditAlert): string {
  const rowWord = alert.total === 1 ? "row" : "rows";
  const changeWord = alert.count === 1 ? "a change" : "changes";
  return `${alert.count} of ${alert.total.toLocaleString()} ${rowWord} will overwrite ${changeWord} someone made by hand in the last 30 days.`;
}

/** Who made the recent edit, as far as we can honestly say. */
export interface ManualEditor {
  /** The name to show, or `null` when the editor isn't recorded. */
  name: string | null;
  /** Where the name came from, when that's worth saying (the sheet only). */
  note: string | null;
}

/**
 * Resolve the "who" for a flagged row, following the profile's
 * "Profile updated by …" display rule that the backend already applied:
 *
 *   * `user`    — an app user is linked to the edit; name them plainly.
 *   * `sheet`   — no linked user, so this is the intake sheet's free-text
 *     "Profile Updated By" name. Still worth showing (it's usually right), but
 *     noted, because nobody stood behind it in the app.
 *   * `unknown` — an older row, or an edit that came from an import. Say so;
 *     never name anyone here, even if `edited_by` somehow carries a value.
 */
export function manualEditor(
  warning: UpdateImportManualEditWarning,
): ManualEditor {
  const name = warning.edited_by?.trim() || null;
  if (!name || warning.edited_by_source === "unknown") {
    return { name: null, note: null };
  }
  if (warning.edited_by_source === "sheet") {
    return { name, note: "from the intake sheet" };
  }
  if (warning.edited_by_source === "user") return { name, note: null };
  // An unrecognized source is treated as unknown rather than trusted — the
  // whole value of this alert is the operator believing what it says.
  return { name: null, note: null };
}

/**
 * When the edit happened, in the same "Aug 5, 2026" form the profile's
 * "Last updated" tile uses for exactly this data. `null` for an unparseable
 * timestamp so the caller can drop the clause rather than print "Invalid Date".
 */
export function manualEditDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
