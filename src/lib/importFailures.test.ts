import { describe, expect, it } from "vitest";

import { parseCsv } from "@/lib/csv";
import {
  REASON_COLUMN_HEADER,
  buildFailedRowsCsv,
  buildPhotoFailuresCsv,
  photoFailureRows,
  unmatchedNote,
} from "@/lib/importFailures";
import type { HeadshotBulkItem, SkippedFile } from "@/lib/photoImport";

const FILE = [
  "Net ID,First Name,Last Name,Employer",
  "jsmith,Jane,Smith,Acme",
  "bjones,Bob,Jones,Globex",
  "cwong,Cara,Wong,Initech",
].join("\r\n");

describe("buildFailedRowsCsv", () => {
  it("exports only the rejected rows, keeping the file's own header", () => {
    const out = buildFailedRowsCsv(FILE, [
      { row: 3, name: "Bob Jones", reason: "Duplicate BYU ID" },
    ]);
    const rows = parseCsv(out.csv!);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual([
      "Net ID",
      "First Name",
      "Last Name",
      "Employer",
      REASON_COLUMN_HEADER,
    ]);
    expect(rows[1]).toEqual(["bjones", "Bob", "Jones", "Globex", "Duplicate BYU ID"]);
    expect(out.exported).toBe(1);
    expect(out.unmatched).toEqual([]);
  });

  it("uses the spreadsheet numbering the importer reports — row 2 is the first data row", () => {
    // Off-by-one here would export the wrong person's data, so pin it hard.
    const out = buildFailedRowsCsv(FILE, [{ row: 2, reason: "Bad year" }]);
    expect(parseCsv(out.csv!)[1][0]).toBe("jsmith");
  });

  it("keeps the trailing reason column UNNAMED so the file re-imports as-is", () => {
    // The strict importers reject any header they don't recognise, but skip a
    // header that is empty (`if extra and extra not in expected`). Naming this
    // column would make the export un-re-uploadable.
    const out = buildFailedRowsCsv(FILE, [{ row: 2, reason: "Bad year" }]);
    expect(REASON_COLUMN_HEADER).toBe("");
    expect(out.csv!.split("\r\n")[0]).toBe(
      "Net ID,First Name,Last Name,Employer,",
    );
  });

  it("exports rows in file order, whatever order the rejects arrive in", () => {
    const out = buildFailedRowsCsv(FILE, [
      { row: 4, reason: "c" },
      { row: 2, reason: "a" },
    ]);
    const rows = parseCsv(out.csv!);
    expect(rows[1][0]).toBe("jsmith");
    expect(rows[2][0]).toBe("cwong");
  });

  it("exports a row named twice only once", () => {
    const out = buildFailedRowsCsv(FILE, [
      { row: 2, reason: "first reason" },
      { row: 2, reason: "second reason" },
    ]);
    expect(out.exported).toBe(1);
    expect(parseCsv(out.csv!)[1][4]).toBe("first reason");
  });

  it("reports header-level rejects (row 0) as unmatched rather than dropping them", () => {
    const out = buildFailedRowsCsv(FILE, [
      { row: 0, name: "(header)", reason: "Missing required column: 'Net ID'." },
      { row: 3, reason: "Duplicate" },
    ]);
    expect(out.exported).toBe(1);
    expect(out.unmatched).toHaveLength(1);
    expect(unmatchedNote(out)).toContain("1 of the 2 skipped rows");
  });

  it("reports a row number past the end of the file as unmatched", () => {
    const out = buildFailedRowsCsv(FILE, [{ row: 99, reason: "Nope" }]);
    expect(out.csv).toBeNull();
    expect(out.unmatched).toHaveLength(1);
  });

  it("returns no file when the upload had no rows at all", () => {
    expect(buildFailedRowsCsv("", [{ row: 2, reason: "x" }]).csv).toBeNull();
  });

  it("says nothing when every reject made it into the file", () => {
    const out = buildFailedRowsCsv(FILE, [{ row: 2, reason: "x" }]);
    expect(unmatchedNote(out)).toBeNull();
  });

  it("pads a short row so the reason lands in the trailing column", () => {
    const ragged = "A,B,C\r\nonly-one";
    const rows = parseCsv(buildFailedRowsCsv(ragged, [{ row: 2, reason: "why" }]).csv!);
    expect(rows[1]).toEqual(["only-one", "", "", "why"]);
  });

  it("trims a row that is WIDER than the header rather than shifting the reason", () => {
    const ragged = "A,B\r\n1,2,3,4";
    const rows = parseCsv(buildFailedRowsCsv(ragged, [{ row: 2, reason: "why" }]).csv!);
    expect(rows[1]).toEqual(["1", "2", "why"]);
  });

  it("counts a blank padding line, matching the importer's row numbering", () => {
    // `_parse_and_map` skips a fully-blank line but still advances the row
    // counter, so an Excel-padded file must not shift the export by one.
    const padded = "A,B\r\n\r\nreal,row";
    const rows = parseCsv(buildFailedRowsCsv(padded, [{ row: 3, reason: "why" }]).csv!);
    expect(rows[1]).toEqual(["real", "row", "why"]);
  });

  it("preserves commas, quotes and newlines inside a rejected row", () => {
    const tricky = [
      "Name,Notes",
      '"Doe, Jane","said ""hi""\nthen left"',
    ].join("\r\n");
    const rows = parseCsv(buildFailedRowsCsv(tricky, [{ row: 2, reason: "dup" }]).csv!);
    expect(rows[1]).toEqual(["Doe, Jane", 'said "hi"\nthen left', "dup"]);
  });

  describe("formula injection", () => {
    it("neutralises a payload smuggled in through a rejected row's cells", () => {
      const hostile = [
        "Net ID,Employer",
        '=cmd|\'/c calc\'!A0,"@SUM(1+9)*cmd|\' /C calc\'!A0"',
      ].join("\r\n");
      const csv = buildFailedRowsCsv(hostile, [{ row: 2, reason: "dup" }]).csv!;
      const cells = parseCsv(csv)[1];
      expect(cells[0]).toBe("\t=cmd|'/c calc'!A0");
      expect(cells[1]).toBe("\t@SUM(1+9)*cmd|' /C calc'!A0");
      // And no cell in the emitted file OPENS with a formula character —
      // which is the property a spreadsheet actually evaluates on.
      for (const row of parseCsv(csv)) {
        for (const cell of row) expect(cell).not.toMatch(/^[=+\-@]/);
      }
    });

    it("neutralises a payload arriving in the REASON, not just the row", () => {
      const csv = buildFailedRowsCsv(FILE, [
        { row: 2, reason: "=HYPERLINK(\"http://evil.test\")" },
      ]).csv!;
      expect(parseCsv(csv)[1][4]).toBe('\t=HYPERLINK("http://evil.test")');
    });

    it("guards the header row too", () => {
      const csv = buildFailedRowsCsv("=evil,B\r\n1,2", [
        { row: 2, reason: "x" },
      ]).csv!;
      expect(parseCsv(csv)[0][0]).toBe("\t=evil");
    });

    it("leaves the guarded value recoverable by the importer's strip()", () => {
      // The tab is what makes this safe AND re-importable: Python's
      // `raw.strip()` removes it, so the round trip stores the real value.
      const csv = buildFailedRowsCsv("A\r\n-5", [{ row: 2, reason: "x" }]).csv!;
      expect(parseCsv(csv)[1][0].trim()).toBe("-5");
    });
  });
});

/* ------------------------------------------------------------ photo import --- */

const item = (
  filename: string,
  status: string,
  net_id: string | null = null,
  message = "",
): HeadshotBulkItem => ({ filename, net_id, status, message });

describe("photoFailureRows", () => {
  const items = [
    item("jsmith.jpg", "matched", "jsmith", "Uploaded"),
    item("nobody.jpg", "no_match", "nobody", "No alumnus has that net ID."),
    item("huge.png", "invalid", "huge", "Over the 20 MB limit."),
    item("flaky.webp", "error", "flaky", "Storage rejected the upload."),
  ];
  const skipped: SkippedFile[] = [
    { name: "photo.heic", reason: "HEIC isn't supported." },
  ];

  it("drops the photos that succeeded", () => {
    expect(photoFailureRows(items, []).map((r) => r.filename)).not.toContain(
      "jsmith.jpg",
    );
  });

  it("includes the files the browser refused before the upload", () => {
    const rows = photoFailureRows([], skipped);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      filename: "photo.heic",
      status: "Skipped",
      action: "Fix the file",
    });
  });

  it("splits a data problem from a retry, which is the whole point", () => {
    const byFile = Object.fromEntries(
      photoFailureRows(items, skipped).map((r) => [r.filename, r.action]),
    );
    expect(byFile["nobody.jpg"]).toBe("Check the net ID");
    expect(byFile["flaky.webp"]).toBe("Retry the upload");
    expect(byFile["huge.png"]).toBe("Fix the file");
  });

  it("groups the worklist by what the operator does about it", () => {
    expect(photoFailureRows(items, skipped).map((r) => r.action)).toEqual([
      "Check the net ID",
      "Retry the upload",
      "Fix the file",
      "Fix the file",
    ]);
  });

  it("falls back to the raw status for one the UI doesn't know", () => {
    const rows = photoFailureRows([item("x.jpg", "quarantined")], []);
    expect(rows[0].status).toBe("quarantined");
    expect(rows[0].action).toBe("Fix the file");
  });
});

describe("buildPhotoFailuresCsv", () => {
  it("returns nothing when every photo landed", () => {
    expect(buildPhotoFailuresCsv([item("a.jpg", "matched")], [])).toEqual({
      csv: null,
      count: 0,
    });
  });

  it("writes one row per failure under a readable header", () => {
    const { csv, count } = buildPhotoFailuresCsv(
      [item("nobody.jpg", "no_match", "nobody", "No alumnus has that net ID.")],
      [],
    );
    expect(count).toBe(1);
    expect(parseCsv(csv!)).toEqual([
      ["File", "Net ID", "Status", "What to do", "Detail"],
      [
        "nobody.jpg",
        "nobody",
        "No match",
        "Check the net ID",
        "No alumnus has that net ID.",
      ],
    ]);
  });

  it("guards a hostile file name — zip members are not our text either", () => {
    const { csv } = buildPhotoFailuresCsv(
      [item("=cmd|'/c calc'!A0.jpg", "no_match", "@evil", "-1+1")],
      [],
    );
    const cells = parseCsv(csv!)[1];
    expect(cells[0]).toBe("\t=cmd|'/c calc'!A0.jpg");
    expect(cells[1]).toBe("\t@evil");
    expect(cells[4]).toBe("\t-1+1");
  });

  it("renders a missing net ID as blank, never the word null", () => {
    const { csv } = buildPhotoFailuresCsv([item("x.jpg", "invalid", null)], []);
    expect(parseCsv(csv!)[1][1]).toBe("");
  });
});
