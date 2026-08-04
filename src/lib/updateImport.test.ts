import { describe, expect, it } from "vitest";

import type { UpdateImportPreview, UpdateImportRowReport } from "@/types/alumni";

import {
  fieldLabel,
  formatCell,
  ignoredColumns,
  isCsvFile,
  partitionPreviewRows,
  previewGate,
} from "./updateImport";

/**
 * Bulk UPDATE import rules (#610).
 *
 * The property worth pinning: NOTHING is applied without an explicit confirm,
 * and the confirm button is reachable only when the dry-run found real changes.
 * The rest guards the review step's honesty — an unmatched Net ID and an
 * unrecognized column must both reach the screen, never be dropped quietly.
 */

const row = (
  over: Partial<UpdateImportRowReport> & { row: number; status: string },
): UpdateImportRowReport =>
  ({
    name: null,
    alumni_id: null,
    changes: [],
    error: null,
    message: null,
    ...over,
  }) as UpdateImportRowReport;

const preview = (over: Partial<UpdateImportPreview> = {}): UpdateImportPreview =>
  ({
    columns_ok: true,
    header_errors: [],
    ignored_columns: [],
    summary: {
      total: 0,
      matched: 0,
      unmatched: 0,
      with_changes: 0,
      errors: 0,
      ...over.summary,
    },
    rows: [],
    ...over,
  }) as UpdateImportPreview;

const file = (name: string, type = ""): File =>
  ({ name, type }) as unknown as File;

describe("isCsvFile", () => {
  it("accepts a .csv whatever MIME type the OS attached", () => {
    expect(isCsvFile(file("cohort.csv"))).toBe(true);
    expect(isCsvFile(file("COHORT.CSV"))).toBe(true);
    // Windows tags .csv as an Excel type; that must not be a rejection.
    expect(isCsvFile(file("cohort.csv", "application/vnd.ms-excel"))).toBe(true);
    expect(isCsvFile(file("no-extension", "text/csv"))).toBe(true);
  });

  it("rejects a workbook or anything else", () => {
    expect(isCsvFile(file("cohort.xlsx"))).toBe(false);
    expect(isCsvFile(file("notes.txt"))).toBe(false);
  });
});

describe("previewGate", () => {
  it("enables Apply only when the dry-run found something to change", () => {
    const gate = previewGate(
      preview({ summary: { total: 3, matched: 3, unmatched: 0, with_changes: 2, errors: 0 } }),
    );
    expect(gate.canApply).toBe(true);
    expect(gate.nothingToDo).toBe(false);
  });

  it("blocks Apply when every matched row already holds these values", () => {
    const gate = previewGate(
      preview({ summary: { total: 3, matched: 3, unmatched: 0, with_changes: 0, errors: 0 } }),
    );
    expect(gate.canApply).toBe(false);
    expect(gate.nothingToDo).toBe(true);
  });

  it("blocks Apply when the header row was unusable, whatever the counts say", () => {
    // columns_ok false means no rows were evaluated; the summary is zeroed
    // server-side, but the gate must not depend on that to stay shut.
    const gate = previewGate(
      preview({
        columns_ok: false,
        header_errors: ["The file needs a 'Net ID' column"],
        summary: { total: 9, matched: 9, unmatched: 0, with_changes: 9, errors: 0 },
      }),
    );
    expect(gate.headersOk).toBe(false);
    expect(gate.canApply).toBe(false);
    // Not "nothing to do" either — that message would be a lie here.
    expect(gate.nothingToDo).toBe(false);
  });
});

describe("partitionPreviewRows", () => {
  it("routes each status to the section that renders it", () => {
    const { changed, unmatched, errored } = partitionPreviewRows([
      row({ row: 2, status: "update" }),
      row({ row: 3, status: "no_changes" }),
      row({ row: 4, status: "unmatched" }),
      row({ row: 5, status: "unmatched_archived" }),
      row({ row: 6, status: "error" }),
    ]);
    expect(changed.map((r) => r.row)).toEqual([2]);
    // An archived-only match is still "we will not update this" to the operator.
    expect(unmatched.map((r) => r.row)).toEqual([4, 5]);
    expect(errored.map((r) => r.row)).toEqual([6]);
  });

  it("never drops an unmatched row on the floor", () => {
    // The regression this guards: a file whose Net IDs mostly miss must SAY so,
    // not silently preview two changes and look like a clean run.
    const rows = [
      row({ row: 2, status: "update" }),
      ...[3, 4, 5].map((n) => row({ row: n, status: "unmatched" })),
    ];
    const { changed, unmatched } = partitionPreviewRows(rows);
    expect(changed).toHaveLength(1);
    expect(unmatched).toHaveLength(3);
    expect(changed.length + unmatched.length).toBe(rows.length);
  });
});

describe("ignoredColumns", () => {
  it("surfaces the columns the backend skipped", () => {
    expect(
      ignoredColumns(preview({ ignored_columns: ["Favorite Color", "Notes to self"] })),
    ).toEqual(["Favorite Color", "Notes to self"]);
  });

  it("is empty — not undefined — when the field is absent", () => {
    // The field is optional on the wire; the review step maps over the result.
    const bare = preview();
    delete (bare as { ignored_columns?: string[] }).ignored_columns;
    expect(ignoredColumns(bare)).toEqual([]);
  });
});

describe("formatCell", () => {
  it("renders an empty value as a dash so a cleared field is visible", () => {
    expect(formatCell(null)).toBe("—");
    expect(formatCell(undefined)).toBe("—");
    expect(formatCell("")).toBe("—");
  });

  it("renders booleans the way the sheet spells them", () => {
    expect(formatCell(true)).toBe("Yes");
    expect(formatCell(false)).toBe("No");
    // Not falsy-collapsed into the dash above.
    expect(formatCell(false)).not.toBe("—");
    expect(formatCell(0)).toBe("0");
  });
});

describe("fieldLabel", () => {
  it("turns a stored field name into something readable", () => {
    expect(fieldLabel("current_employer")).toBe("Current employer");
    expect(fieldLabel("net_id")).toBe("Net id");
    expect(fieldLabel("")).toBe("");
  });
});
