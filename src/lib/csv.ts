/**
 * CSV primitives for the browser-side export paths (#693).
 *
 * The server owns every export that is generated from the DATABASE — see
 * `alumni_export._fmt` in fa-web-api, which is the canonical formula-injection
 * guard for this product. This module exists for the one class of file the
 * server cannot build: an export derived from the spreadsheet the operator just
 * uploaded, whose cell values only the browser still holds.
 *
 * Nothing here touches the DOM or the network, so the parser, the quoting and
 * the injection guard are all unit-testable.
 */

/**
 * Leading characters that make Excel / LibreOffice / Sheets evaluate a cell as
 * a live formula.
 *
 * Matches with optional leading whitespace on purpose: the server's guard tests
 * `text[0]` only, which a value like `" =cmd|'/c calc'!A0"` slips past. This is
 * the same regex `DonationsImportWizard` already used, kept as the single
 * detector so there is one answer to "is this cell dangerous".
 */
export const FORMULA_LEAD_RE = /^\s*[=+\-@\t\r]/;

/**
 * Neutralise one cell for a CSV download.
 *
 * The defence is a leading TAB, mirroring `alumni_export._fmt`, NOT the leading
 * apostrophe some spreadsheets use. That choice is load-bearing here: these
 * files are meant to be corrected and re-uploaded, and the importer coerces
 * every text cell with Python's `str.strip()` — which removes the tab and
 * restores the original value. An apostrophe would survive as real data and
 * quietly corrupt the round trip.
 *
 * Sanitise on OUTPUT only. The stored/parsed value keeps whatever it really was
 * (a "+1 555…" phone number is not an attack, it just looks like one).
 */
export function csvSafeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text === "") return "";
  return FORMULA_LEAD_RE.test(text) ? `\t${text}` : text;
}

/**
 * Quote a single already-sanitised cell, RFC 4180 style and minimally — a
 * file where every cell is quoted is legal but reads as machine spew when the
 * operator opens it, and this one is meant to be edited by hand.
 *
 * Leading/trailing whitespace forces quoting so the tab the guard above adds
 * cannot be eaten by a spreadsheet that trims unquoted fields.
 */
function quoteCell(cell: string): string {
  const needsQuotes = /[",\r\n]/.test(cell) || cell !== cell.trim();
  return needsQuotes ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Serialise one row. Cells are sanitised, then quoted where needed. */
export function csvLine(cells: readonly unknown[]): string {
  return cells.map((c) => quoteCell(csvSafeCell(c))).join(",");
}

/**
 * Serialise rows to CSV text with CRLF line endings (what Excel expects, and
 * what every other export in this app emits). No trailing newline.
 */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map(csvLine).join("\r\n");
}

/**
 * Parse CSV text into records, deliberately matching Python's `csv.reader`
 * (the reader on the other end of the round trip) rather than being clever:
 *
 *   * a `"` only opens a quoted field at the START of a field — `ab"cd` keeps
 *     its quote as data, exactly as `csv.reader` does;
 *   * `""` inside a quoted field is one literal quote;
 *   * CR, LF and CRLF all end a record, and a quoted field may contain them;
 *   * a trailing newline does NOT produce a final empty record.
 *
 * The BOM Excel writes is stripped, since `_decode_upload` strips it too.
 *
 * Row numbering: record index 0 is spreadsheet row 1 (the header), so record
 * index N is spreadsheet row N+1 — the numbering the importer reports rejects
 * with, and the numbering the operator sees in Excel.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += ch === "\r" && src[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field !== "" || row.length > 0 || inQuotes) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Trigger a browser download of `text` as `filename`.
 *
 * The one DOM-touching export here; kept beside the builders so a caller does
 * not have to hand-roll the Blob/anchor dance for the fifth time.
 */
export function downloadCsvFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
