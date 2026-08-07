import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type {
  UpdateImportManualEditWarning,
  UpdateImportPreview,
  UpdateImportRowReport,
  UpdateImportSummary,
} from "@/types/alumni";

import {
  fieldLabel,
  formatCell,
  ignoredColumns,
  isCsvFile,
  manualEditAlert,
  manualEditDate,
  manualEditHeadline,
  manualEditor,
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
    overwrites_manual_edit: null,
    ...over,
  }) as UpdateImportRowReport;

const preview = (
  over: Partial<Omit<UpdateImportPreview, "summary">> & {
    summary?: Partial<UpdateImportSummary>;
  } = {},
): UpdateImportPreview =>
  ({
    columns_ok: true,
    header_errors: [],
    ignored_columns: [],
    rows: [],
    ...over,
    // Merged AFTER the spread, so overriding one count doesn't silently drop
    // the others (a caller that only cares about `total` still gets a summary
    // with every field the review step reads).
    summary: {
      total: 0,
      matched: 0,
      unmatched: 0,
      with_changes: 0,
      errors: 0,
      overwrites_manual_edit: 0,
      ...over.summary,
    },
  }) as UpdateImportPreview;

const warning = (
  over: Partial<UpdateImportManualEditWarning> = {},
): UpdateImportManualEditWarning => ({
  manually_edited_at: "2026-08-05T14:03:11.482913+00:00",
  edited_by: "Amy Adams",
  edited_by_source: "user",
  ...over,
});

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

/**
 * Overwriting a recent hand edit (#420).
 *
 * The bug: a staffer corrects an employer in the profile editor, a colleague
 * uploads a week-old cohort export, and the correction is silently reverted —
 * it looks like an ordinary field change in the preview. Jake's call was WARN,
 * NOT BLOCK, so what these pin is that the warning appears when (and only when)
 * there is something to warn about, that it names rows honestly, and that it
 * never touches the Apply gate.
 */
describe("manualEditAlert", () => {
  it("shows nothing when no row would overwrite a recent edit", () => {
    // A warning on every import is one people learn to dismiss.
    const alert = manualEditAlert(
      preview({
        summary: { total: 2000, with_changes: 1400 },
        rows: [row({ row: 2, status: "update" })],
      }),
    );
    expect(alert.show).toBe(false);
    expect(alert.count).toBe(0);
    expect(alert.rows).toEqual([]);
  });

  it("collects the flagged rows and takes the count from the summary", () => {
    const alert = manualEditAlert(
      preview({
        summary: { total: 2000, with_changes: 1400, overwrites_manual_edit: 2 },
        rows: [
          row({ row: 2, status: "update" }),
          row({ row: 3, status: "update", overwrites_manual_edit: warning() }),
          row({ row: 9, status: "update", overwrites_manual_edit: warning() }),
        ],
      }),
    );
    expect(alert.show).toBe(true);
    expect(alert.count).toBe(2);
    expect(alert.total).toBe(2000);
    expect(alert.rows.map((r) => r.row)).toEqual([3, 9]);
  });

  it("falls back to the flagged rows when the summary count is absent", () => {
    // A payload from before the summary field existed must still warn rather
    // than render a silent zero.
    const bare = preview({
      summary: { total: 3 },
      rows: [row({ row: 2, status: "update", overwrites_manual_edit: warning() })],
    });
    delete (bare.summary as { overwrites_manual_edit?: number })
      .overwrites_manual_edit;
    const alert = manualEditAlert(bare);
    expect(alert.count).toBe(1);
    expect(alert.show).toBe(true);
  });
});

describe("manualEditHeadline", () => {
  it("leads with the number, in plain words", () => {
    const alert = manualEditAlert(
      preview({
        summary: { total: 2000, overwrites_manual_edit: 3 },
      }),
    );
    expect(manualEditHeadline(alert)).toBe(
      "3 of 2,000 rows will overwrite changes someone made by hand in the last 30 days.",
    );
  });

  it("reads as one change at exactly one flagged row", () => {
    const alert = manualEditAlert(
      preview({ summary: { total: 2000, overwrites_manual_edit: 1 } }),
    );
    const text = manualEditHeadline(alert);
    expect(text).toBe(
      "1 of 2,000 rows will overwrite a change someone made by hand in the last 30 days.",
    );
    expect(text).not.toContain("changes");
  });

  it("keeps 'rows' agreeing with the file, not with the flagged count", () => {
    // "1 of 2,000 rows" — the noun follows the total; only "a change" follows
    // the count. A one-row file is the one case where both are singular.
    const one = manualEditAlert(
      preview({ summary: { total: 1, overwrites_manual_edit: 1 } }),
    );
    expect(manualEditHeadline(one)).toContain("1 of 1 row will");
  });
});

describe("manualEditor", () => {
  it("names the app user behind the edit", () => {
    expect(manualEditor(warning({ edited_by_source: "user" }))).toEqual({
      name: "Amy Adams",
      note: null,
    });
  });

  it("names a sheet-sourced editor but says where the name came from", () => {
    expect(manualEditor(warning({ edited_by_source: "sheet" }))).toEqual({
      name: "Amy Adams",
      note: "from the intake sheet",
    });
  });

  it("names nobody when the editor isn't known", () => {
    // The whole value of this alert is that the operator believes it, so an
    // `unknown` source names no one even if a stale name rode along.
    expect(
      manualEditor(
        warning({ edited_by: "Amy Adams", edited_by_source: "unknown" }),
      ),
    ).toEqual({ name: null, note: null });
    expect(manualEditor(warning({ edited_by: null }))).toEqual({
      name: null,
      note: null,
    });
    expect(manualEditor(warning({ edited_by: "   " }))).toEqual({
      name: null,
      note: null,
    });
    // An unrecognized source is treated as unknown, not trusted.
    expect(manualEditor(warning({ edited_by_source: "wat" }))).toEqual({
      name: null,
      note: null,
    });
  });
});

describe("manualEditDate", () => {
  it("uses the same 'Aug 5, 2026' form the profile's Last updated tile uses", () => {
    // Asserted loosely on the day so the suite doesn't depend on the runner's
    // timezone; the shape is what matters.
    expect(manualEditDate("2026-08-05T14:03:11.482913+00:00")).toMatch(
      /^Aug \d{1,2}, 2026$/,
    );
  });

  it("returns null for an unparseable timestamp instead of 'Invalid Date'", () => {
    expect(manualEditDate("not a date")).toBeNull();
    expect(manualEditDate("")).toBeNull();
  });
});

describe("warn-don't-block invariant (#420)", () => {
  const wizard = readFileSync(
    resolve(process.cwd(), "src/components/alumni/import/UpdateImportWizard.tsx"),
    "utf8",
  );

  it("renders the warning only behind the alert's own `show` gate", () => {
    expect(wizard).toContain("manualEdits.show && <ManualEditWarning");
  });

  it("leaves Apply gated on `canApply` alone", () => {
    // Jake was explicit: warn, don't block. Apply must not learn about the
    // manual-edit count, directly or through `previewGate`.
    expect(wizard).toContain("disabled={!canApply || updating}");
    expect(wizard).not.toMatch(/disabled=\{[^}]*manualEdit/i);
  });
});
