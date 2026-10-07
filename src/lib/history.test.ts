import { describe, expect, it } from "vitest";
import type { AlumniHistoryChange, AlumniHistoryGroup } from "@/types/history";
import {
  actionLabel,
  describeChange,
  historyRequestPath,
  historyStartLabel,
  mergeHistoryPages,
  sourceLabel,
} from "./history";

const change = (over: Partial<AlumniHistoryChange>): AlumniHistoryChange => ({
  audit_id: 1,
  action: "update",
  field: null,
  label: null,
  old: null,
  new: null,
  redacted: false,
  ...over,
});

const group = (id: string): AlumniHistoryGroup => ({
  group_id: id,
  change_set_id: id,
  at: "2026-09-01T12:00:00Z",
  actor_name: "Sam",
  source: "manual",
  changes: [],
});

describe("historyRequestPath", () => {
  it("builds the first page and a cursor page", () => {
    expect(historyRequestPath(7)).toBe("/alumni/7/history?limit=20");
    expect(historyRequestPath(7, "abc+/=")).toBe(
      "/alumni/7/history?limit=20&before=abc%2B%2F%3D",
    );
  });
});

describe("describeChange", () => {
  it("shows a field edit under the backend label as a diff", () => {
    const v = describeChange(
      change({ field: "first_name", label: "First name", old: "A", new: "B" }),
    );
    expect(v).toEqual({ title: "First name", kind: "diff", old: "A", new: "B" });
  });

  it("falls back to a humanized field name when no label", () => {
    expect(
      describeChange(change({ field: "contact.zip_code", old: "1", new: "2" }))
        .title,
    ).toBe("Zip code");
  });

  it("an emptied field still reads as a diff", () => {
    const v = describeChange(change({ field: "notes", old: "x", new: null }));
    expect(v.kind).toBe("diff");
    expect(v.new).toBe("—");
  });

  it("names non-edit actions", () => {
    expect(describeChange(change({ action: "add_tag", new: "Mentor" }))).toEqual(
      { title: "Tag added", kind: "added", old: "—", new: "Mentor" },
    );
    expect(describeChange(change({ action: "delete_employment", old: "x" })).kind).toBe(
      "removed",
    );
    expect(describeChange(change({ action: "archive" })).kind).toBe("none");
  });

  it("never shows values that were redacted", () => {
    expect(
      describeChange(change({ field: "gender", redacted: true })).kind,
    ).toBe("hidden");
  });
});

describe("labels", () => {
  it("unknown actions are humanized", () => {
    expect(actionLabel("frobnicate_widget")).toBe("Frobnicate widget");
  });
  it("source labels", () => {
    expect(sourceLabel("import")).toBe("Import");
    expect(sourceLabel(null)).toBe("—");
  });
  it("start date", () => {
    expect(historyStartLabel("2026-08-18")).toBe("Aug 18, 2026");
  });
});

describe("mergeHistoryPages", () => {
  it("appends without duplicating groups", () => {
    expect(
      mergeHistoryPages([group("a"), group("b")], [group("b"), group("c")]).map(
        (g) => g.group_id,
      ),
    ).toEqual(["a", "b", "c"]);
  });
});
