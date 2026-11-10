import { describe, expect, it } from "vitest";

import {
  approveRequestBody,
  approvedMessage,
  kindLabel,
  matchProfileHref,
  matchReasonLabel,
  mergeButtonLabel,
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
