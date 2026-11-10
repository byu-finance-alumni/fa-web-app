import { describe, expect, it } from "vitest";

import {
  BULK_REJECT_MAX,
  approveRequestBody,
  approveWarningsText,
  bulkRejectChunks,
  isEmailField,
  mergeRowKind,
  overwriteFieldsFrom,
  pruneSelection,
  toggleAll,
  toggleSelected,
  approvedMessage,
  kindLabel,
  matchProfileHref,
  matchReasonLabel,
  mergeButtonLabel,
  submissionFieldLabel,
} from "./new-people-review";

const item = { submitted_at: "2026-11-10T17:00:00.123456Z", name: "Ada Lovelace", comments: null };

describe("new-people review helpers", () => {
  it("always sends submitted_at back, for create and for merge", () => {
    expect(approveRequestBody(item, { action: "create", kind: "friend" })).toEqual({
      action: "create",
      kind: "friend",
      alumni_id: null,
      submitted_at: item.submitted_at,
    });
    expect(approveRequestBody(item, { action: "merge", alumniId: 42 })).toEqual({
      action: "merge",
      kind: null,
      alumni_id: 42,
      submitted_at: item.submitted_at,
      overwrite_fields: [],
    });
  });

  it("links a match to the right profile area", () => {
    const base = { alumni_id: 7, name: "A", graduation_year: 2001, match_reason: "email" as const };
    expect(matchProfileHref({ ...base, is_friend: false })).toBe("/alumni/7");
    expect(matchProfileHref({ ...base, is_friend: true })).toBe("/friends/7");
    expect(mergeButtonLabel({ ...base, is_friend: false })).toBe("Update A");
  });

  it("labels kinds and match reasons", () => {
    expect(kindLabel("alum")).toBe("BYU alum");
    expect(kindLabel("friend")).toMatch(/friend/);
    expect(matchReasonLabel("email")).toBe("Same email");
    expect(matchReasonLabel("name")).toBe("Similar name");
  });

  it("says where a comment went", () => {
    expect(approvedMessage(item, { action: "create", kind: "alum" })).toBe(
      "Added Ada Lovelace as an alum.",
    );
    expect(
      approvedMessage({ ...item, comments: "hi" }, { action: "merge", alumniId: 1 }, "Ada L"),
    ).toBe("Updated Ada L with Ada Lovelace's answers. Their comment was saved as a note on the profile.");
  });
});

describe("merge review (round 2)", () => {
  const preview = { overwrites: ["contact.personal_email", "employment.current_employer"] };

  it("fills blanks automatically and only offers Replace on populated fields", () => {
    expect(mergeRowKind(preview, "contact.personal_email")).toBe("overwrite");
    expect(mergeRowKind(preview, "contact.phone")).toBe("fill");
  });

  it("sends nothing to overwrite by default", () => {
    expect(overwriteFieldsFrom(preview, new Set())).toEqual([]);
  });

  it("sends only ticked keys that are real overwrites, in preview order", () => {
    expect(
      overwriteFieldsFrom(
        preview,
        new Set(["employment.current_employer", "contact.phone", "contact.personal_email"]),
      ),
    ).toEqual(["contact.personal_email", "employment.current_employer"]);
  });

  it("carries overwrite_fields into the merge body", () => {
    expect(
      approveRequestBody(item, {
        action: "merge",
        alumniId: 3,
        overwriteFields: ["contact.work_email"],
      }).overwrite_fields,
    ).toEqual(["contact.work_email"]);
    expect(
      "overwrite_fields" in approveRequestBody(item, { action: "create", kind: "alum" }),
    ).toBe(false);
  });

  it("flags email fields for the caution line", () => {
    expect(isEmailField("contact.personal_email")).toBe(true);
    expect(isEmailField("contact.work_email")).toBe(true);
    expect(isEmailField("contact.phone")).toBe(false);
    expect(isEmailField("employment.current_employer")).toBe(false);
  });

  it("explains kind_mismatch from the submitted kind, and keeps unknown warnings", () => {
    expect(approveWarningsText(["kind_mismatch"], "friend")).toEqual([
      "Note: submitted as a friend but merged into a record of the other kind.",
    ]);
    expect(approveWarningsText(["kind_mismatch"], "alum")).toEqual([
      "Note: submitted as an alum but merged into a record of the other kind.",
    ]);
    expect(approveWarningsText(["something_new"], "alum")).toEqual(["Note: something_new"]);
    expect(approveWarningsText(undefined, "alum")).toEqual([]);
  });
});

describe("bulk reject selection (round 2)", () => {
  it("toggles one id", () => {
    const a = toggleSelected(new Set(), 1);
    expect([...a]).toEqual([1]);
    expect([...toggleSelected(a, 1)]).toEqual([]);
  });

  it("Select all selects everything, and clears when all are selected", () => {
    expect([...toggleAll(new Set([2]), [1, 2, 3])].sort()).toEqual([1, 2, 3]);
    expect([...toggleAll(new Set([1, 2, 3]), [1, 2, 3])]).toEqual([]);
    expect([...toggleAll(new Set(), [])]).toEqual([]);
  });

  it("drops ids that left the queue", () => {
    expect([...pruneSelection(new Set([1, 2, 9]), [1, 2, 3])]).toEqual([1, 2]);
  });

  it("chunks ids to the endpoint's 500 cap", () => {
    const ids = Array.from({ length: 1201 }, (_, i) => i + 1);
    const chunks = bulkRejectChunks(ids);
    expect(chunks.map((c) => c.length)).toEqual([BULK_REJECT_MAX, BULK_REJECT_MAX, 201]);
    expect(chunks.flat()).toEqual(ids);
    expect(bulkRejectChunks([])).toEqual([]);
  });
});

describe("BYU ID in the staff queue (api#661)", () => {
  it("labels new.byu_id as BYU ID, and leaves other labels to the server", () => {
    expect(submissionFieldLabel("new.byu_id", "new.byu_id")).toBe("BYU ID");
    expect(submissionFieldLabel("new.byu_id", null)).toBe("BYU ID");
    expect(submissionFieldLabel("profile.first_name", "First name")).toBe("First name");
    expect(submissionFieldLabel("x.y", "")).toBe("x.y");
  });

  it("names a BYU ID match", () => {
    expect(matchReasonLabel("byu_id")).toBe("Same BYU ID");
    expect(matchReasonLabel("email")).toBe("Same email");
  });
});
