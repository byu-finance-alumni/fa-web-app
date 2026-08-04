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

import type { UpdateImportPreview, UpdateImportRowReport } from "@/types/alumni";

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
