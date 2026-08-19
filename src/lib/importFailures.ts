/**
 * Build the "just the ones that broke" downloads for the import flows (#693).
 *
 * The problem this solves: an import of 2,000 rows reports "row 1483 rejected:
 * duplicate BYU ID" on screen and stops there. Acting on that means opening the
 * original spreadsheet, finding those rows by eye, and rebuilding a file by
 * hand — at which point most operators just re-upload everything and re-process
 * the 1,985 rows that were already fine.
 *
 * Everything here runs in the BROWSER, from the file the operator uploaded a
 * moment ago. The API's `ImportReject` carries a row number and a reason but
 * NOT the row's values, so the server could not emit a re-uploadable file
 * without echoing alumni PII back through another response — for no gain, since
 * the browser still has the bytes.
 *
 * Pure functions over text, so both the row matching and the injection guard
 * are unit-testable without a DOM.
 */

import { parseCsv, toCsv } from "@/lib/csv";
import type { HeadshotBulkItem, SkippedFile } from "@/lib/photoImport";

/* ------------------------------------------- alumni / friends / donations --- */

/** One rejected row as the commit endpoints report it (`ImportReject`). */
export interface ImportRejectLike {
  row: number;
  name?: string | null;
  reason: string;
}

export interface FailedRowsExport {
  /** The CSV text to download, or `null` when nothing could be matched back. */
  csv: string | null;
  /** How many rejected rows are in the file. */
  exported: number;
  /**
   * Rejects that name no data row in the uploaded file — a header-level reject
   * (the API reports those as row 0), or a row number past the end of the file
   * because the operator edited it between upload and download. Never silently
   * dropped: the caller says how many are missing.
   */
  unmatched: ImportRejectLike[];
}

/**
 * THE TRAILING REASON COLUMN HAS A BLANK HEADER, AND THAT IS DELIBERATE.
 *
 * The alumni, friend and donation importers all validate headers strictly:
 * `_validate_headers` in fa-web-api rejects the whole file with "Unexpected
 * column: 'reason'." for any header it does not recognise. A named error column
 * would therefore make this export re-importable only after the operator
 * deleted it — which is exactly the manual step this issue exists to remove.
 *
 * What those same validators do NOT reject is a column whose header is EMPTY:
 * every check is written `if extra and extra not in expected`, and the mapper
 * looks the header up with `mapping.get("")`, which misses. So an unnamed
 * trailing column carries the reason to the operator and is invisible to the
 * importer. Verified against `_validate_headers` (alumni + friends),
 * `_validate_partial_headers` / `_match_known_header` (the update path) and
 * `import_donations._validate_headers`.
 *
 * If a future backend change starts rejecting unnamed columns, this constant is
 * the one place to revisit — and the export stops being re-importable, so it
 * would need a real ignored-column contract instead.
 */
export const REASON_COLUMN_HEADER = "";

/**
 * Build a re-importable CSV of only the rows the import skipped.
 *
 * The output is the uploaded file's own header row, in its own column order,
 * followed by the skipped rows verbatim, each with its reason appended in the
 * unnamed trailing column described above. Correct the rows, upload the same
 * file, done — no reshaping, and nothing that already imported is re-processed.
 *
 * `rejects` are matched by spreadsheet row number: record 0 of the file is row
 * 1 (the header), so a reject for row N is record N-1. That is the numbering
 * `_parse_and_map` assigns (`enumerate(reader, start=2)` after consuming the
 * header) and the numbering Excel shows the operator, so the three agree.
 * Blank padding lines are counted by both sides, which is what keeps them
 * agreeing on a file Excel padded at the end.
 *
 * Short rows are padded out to the header width first, so the reason always
 * lands in the trailing column rather than in whichever column happened to be
 * missing.
 */
export function buildFailedRowsCsv(
  fileText: string,
  rejects: readonly ImportRejectLike[],
): FailedRowsExport {
  const records = parseCsv(fileText);
  if (records.length === 0) {
    return { csv: null, exported: 0, unmatched: [...rejects] };
  }
  const header = records[0];
  const width = header.length;

  const unmatched: ImportRejectLike[] = [];
  const out: string[][] = [[...header, REASON_COLUMN_HEADER]];
  const seen = new Set<number>();

  // File order, not reject order, so the download reads like the spreadsheet.
  for (const reject of [...rejects].sort((a, b) => a.row - b.row)) {
    const index = reject.row - 1;
    if (!Number.isInteger(index) || index < 1 || index >= records.length) {
      unmatched.push(reject);
      continue;
    }
    // A row named twice (two validators disliking it) is exported once, with
    // the first reason — duplicating it would duplicate the person on re-import.
    if (seen.has(index)) continue;
    seen.add(index);

    const cells = records[index].slice(0, width);
    while (cells.length < width) cells.push("");
    out.push([...cells, reject.reason]);
  }

  const exported = out.length - 1;
  return {
    csv: exported > 0 ? toCsv(out) : null,
    exported,
    unmatched,
  };
}

/* ----------------------------------------------------------- photo import --- */

/**
 * How a failed photo is acted on, which is the only thing that changes what the
 * operator does next (#693): a net ID nobody holds is a DATA problem to chase
 * in the roster, a storage failure is worth simply dragging in again, and a
 * rejected file has to be replaced. Carried as its own column so a long list
 * can be sorted or filtered in the spreadsheet.
 */
export type PhotoFailureAction =
  | "Check the net ID"
  | "Retry the upload"
  | "Fix the file";

export interface PhotoFailureRow {
  filename: string;
  netId: string;
  status: string;
  action: PhotoFailureAction;
  detail: string;
}

const PHOTO_STATUS_LABEL: Record<string, string> = {
  no_match: "No match",
  invalid: "Invalid",
  error: "Error",
};

const PHOTO_STATUS_ACTION: Record<string, PhotoFailureAction> = {
  no_match: "Check the net ID",
  invalid: "Fix the file",
  error: "Retry the upload",
};

/** Order the worklist by what the operator does about it, then by file name. */
const ACTION_ORDER: PhotoFailureAction[] = [
  "Check the net ID",
  "Retry the upload",
  "Fix the file",
];

/**
 * Every photo that did not end up on a profile, from BOTH halves of the flow:
 *
 *   * `items` — the per-file report the API returns for photos it was asked
 *     about (`matched` ones are dropped; they are not failures);
 *   * `skipped` — files the browser left out BEFORE the upload (a HEIC, an
 *     oversized image, a stray `.DS_Store`). The results table deliberately
 *     does not list these, so an export that omitted them would understate the
 *     work left to do.
 *
 * Unlike the row export this is a WORKLIST, not a round trip — the payload is
 * images, so there is nothing to correct and re-upload as a file.
 */
export function photoFailureRows(
  items: readonly HeadshotBulkItem[],
  skipped: readonly SkippedFile[],
): PhotoFailureRow[] {
  const rows: PhotoFailureRow[] = [];

  for (const item of items) {
    if (item.status === "matched") continue;
    rows.push({
      filename: item.filename,
      netId: item.net_id ?? "",
      status: PHOTO_STATUS_LABEL[item.status] ?? item.status,
      action: PHOTO_STATUS_ACTION[item.status] ?? "Fix the file",
      detail: item.message ?? "",
    });
  }

  for (const file of skipped) {
    rows.push({
      filename: file.name,
      netId: "",
      status: "Skipped",
      action: "Fix the file",
      detail: file.reason,
    });
  }

  return rows.sort((a, b) => {
    const byAction =
      ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action);
    return byAction !== 0 ? byAction : a.filename.localeCompare(b.filename);
  });
}

export const PHOTO_FAILURE_HEADER = [
  "File",
  "Net ID",
  "Status",
  "What to do",
  "Detail",
] as const;

/**
 * The failed-photo worklist as CSV, or `null` when nothing failed.
 *
 * File names come from a zip the operator was handed, so they are as
 * attacker-influenced as any imported cell — `toCsv` runs the same guard over
 * them that the row export uses.
 */
export function buildPhotoFailuresCsv(
  items: readonly HeadshotBulkItem[],
  skipped: readonly SkippedFile[],
): { csv: string | null; count: number } {
  const rows = photoFailureRows(items, skipped);
  if (rows.length === 0) return { csv: null, count: 0 };
  return {
    csv: toCsv([
      [...PHOTO_FAILURE_HEADER],
      ...rows.map((r) => [r.filename, r.netId, r.status, r.action, r.detail]),
    ]),
    count: rows.length,
  };
}

/* --------------------------------------------------------------- messages --- */

/**
 * What to tell the operator when the row export could not be built. Never
 * carries an exception, a stack, or anything from an upstream response — the
 * only useful half is what they can do about it.
 */
export const FAILED_ROWS_UNAVAILABLE =
  "Couldn't match the skipped rows back to the file you uploaded. The reasons above still list every one.";

export const FAILED_ROWS_UNREADABLE =
  "Couldn't read the file you uploaded. Choose it again, then download the skipped rows.";

/** The one-line explanation of the trailing unnamed column, for the UI. */
export const REASON_COLUMN_NOTE =
  "You get the original columns with only the skipped rows, plus a last, unnamed column holding the reason each was skipped. Fix the rows and upload the file as it is — the importer ignores that extra column.";

/** "3 of 12 skipped rows" style note when some rejects have no row to export. */
export function unmatchedNote(result: FailedRowsExport): string | null {
  const missing = result.unmatched.length;
  if (missing === 0) return null;
  const total = result.exported + missing;
  return `${missing} of the ${total} skipped rows aren't in the download — they were rejected before any row was read (see the reasons above).`;
}
