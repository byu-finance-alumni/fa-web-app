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

/* ------------------------------------------------- preview (dry-run) rows --- */

/**
 * One row of an import PREVIEW, in the shape both dry-run reports share.
 *
 * The preview and the commit describe the same rows in different words: the
 * commit returns `ImportReject` (`row`/`name`/`reason`), while the preview
 * returns a per-row report carrying a `status` plus the findings that produced
 * it. Only the fields this adapter reads are declared, and every one but
 * `row`/`status` is optional, so this covers `AlumniImportRowReport` (which has
 * `error`) and `DonationImportRowReport` (which does not) with one type.
 *
 * `status` is deliberately a plain `string`, not the `"importable" | "rejected"`
 * union the hand-written frontend types use: the backend schemas type it as a
 * bare `str`, so a status added there must land in the "will not import" half
 * rather than failing to type-check here.
 */
export interface ImportPreviewRowLike {
  row: number;
  name?: string | null;
  status: string;
  error?: string | null;
  blockers?: readonly { message: string }[] | null;
  /**
   * Declared, and deliberately never read. A warned row is still IMPORTABLE —
   * warnings are advisory ("possible duplicate of #41", "missing employer") and
   * never move `status` — so including one here would hand the operator a
   * "fix these" file full of rows that were about to import correctly. Spelled
   * out in the type so the omission reads as a decision, not an oversight.
   */
  warnings?: readonly { message: string }[] | null;
}

/**
 * The one status that means "this row WILL be imported".
 *
 * The predicate is `status !== "importable"`, NOT `status === "rejected"`, and
 * that is the whole point of this adapter. Both commit loops in fa-web-api
 * (`import_csv.commit` and `import_donations.commit`) decide with exactly
 * `if evaluated["status"] != "importable": skip`, so anything that is not this
 * literal is a row the operator will not get — including any status a later
 * backend change introduces. Testing for `"rejected"` would silently drop such
 * a row from the download while the wizard still refused to import it.
 *
 * A row with WARNINGS is untouched by this: warnings never change `status`
 * (`status = "rejected" if blockers else "importable"`), so a warned row stays
 * importable and stays out of the download — it is going to import fine.
 */
const IMPORTABLE_STATUS = "importable";

/**
 * Reason text for a preview row, mirroring `_reject_reason` in fa-web-api so a
 * row reads the same whether it was downloaded before the import or after it.
 *
 * Order matters: a mapping/validation `error` is the most specific thing we
 * know, then the first blocker, then a bare fallback. Blockers do most of the
 * work in practice — a duplicate BYU ID sets a blocker and leaves `error` null,
 * and the donations preview has no `error` field at all.
 */
function previewRejectReason(row: ImportPreviewRowLike): string {
  const error = row.error?.trim();
  if (error) return error;
  const blocker = row.blockers?.[0]?.message?.trim();
  if (blocker) return blocker;
  return "Rejected.";
}

/**
 * Adapt a PREVIEW report's rows to the reject shape `buildFailedRowsCsv` takes,
 * keeping only the rows that will not import.
 *
 * This exists because the download matters MOST at the preview step — that is
 * where the operator finds out, before anything has been written — but the
 * preview speaks in statuses and findings while the export speaks in rejects.
 * Row order is preserved; `buildFailedRowsCsv` re-sorts into file order anyway.
 */
export function previewRejects(
  rows: readonly ImportPreviewRowLike[],
): ImportRejectLike[] {
  const out: ImportRejectLike[] = [];
  for (const row of rows) {
    if (row.status === IMPORTABLE_STATUS) continue;
    out.push({
      row: row.row,
      name: row.name ?? null,
      reason: previewRejectReason(row),
    });
  }
  return out;
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

/**
 * The same explanation for the PREVIEW step, where nothing has been imported
 * yet. The result screen's copy is past tense ("were skipped"), which would
 * tell the operator the opposite of what is true here — the rows have not been
 * skipped, they WILL be if the import runs as it stands.
 */
export const REASON_COLUMN_NOTE_PREVIEW =
  "You get the original columns with only the rows that won't import, plus a last, unnamed column holding the reason each will be skipped. Fix the rows and upload the file as it is — the importer ignores that extra column.";

/** "3 of 12 skipped rows" style note when some rejects have no row to export. */
export function unmatchedNote(result: FailedRowsExport): string | null {
  const missing = result.unmatched.length;
  if (missing === 0) return null;
  const total = result.exported + missing;
  return `${missing} of the ${total} skipped rows aren't in the download — they were rejected before any row was read (see the reasons above).`;
}
