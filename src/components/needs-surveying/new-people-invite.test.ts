import { describe, expect, it } from "vitest";

import {
  INVITE_SKIP_LABELS,
  groupSkipped,
  inviteConfirmText,
  inviteCount,
  inviteSentText,
  inviteTokens,
  uniqueInviteTokens,
} from "./new-people-invite";

describe("new-people invite helpers", () => {
  it("splits on any mix of commas, semicolons, spaces and newlines", () => {
    expect(inviteTokens("a@x.com, b@x.com;c@x.com d@x.com\ne@x.com\r\n\tf@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
      "e@x.com",
      "f@x.com",
    ]);
  });

  it("ignores empty pieces and blank input", () => {
    expect(inviteTokens("")).toEqual([]);
    expect(inviteTokens("  ,, ;\n\n ")).toEqual([]);
    expect(inviteCount("   ")).toBe(0);
    expect(inviteTokens(",a@x.com,,")).toEqual(["a@x.com"]);
  });

  it("dedupes case-insensitively, keeping first-seen order", () => {
    expect(uniqueInviteTokens("B@x.com a@x.com b@X.COM A@x.com")).toEqual(["b@x.com", "a@x.com"]);
    expect(inviteCount("B@x.com a@x.com b@X.COM A@x.com")).toBe(2);
  });

  it("counts invalid tokens too (the server decides what is valid)", () => {
    expect(inviteCount("not-an-email a@x.com")).toBe(2);
  });

  it("words the confirm and success lines", () => {
    expect(inviteConfirmText(3)).toBe("Send the survey link to 3 addresses?");
    expect(inviteConfirmText(1)).toBe("Send the survey link to 1 address?");
    expect(inviteSentText(4)).toBe("Sent to 4.");
    expect(inviteSentText(0)).toBe("Sent to 0.");
  });

  it("has a plain label for every skip reason", () => {
    expect(INVITE_SKIP_LABELS).toEqual({
      invalid: "Not a valid email",
      duplicate: "Listed twice",
      in_database: "Already in the database",
      recently_invited: "Already sent in the last 30 days",
    });
  });

  it("groups skipped addresses by reason in a fixed order, dropping empty groups", () => {
    const groups = groupSkipped([
      { email: "old@x.com", reason: "recently_invited" },
      { email: "nope", reason: "invalid" },
      { email: "alum@x.com", reason: "in_database" },
      { email: "bad@", reason: "invalid" },
    ]);
    expect(groups).toEqual([
      { reason: "invalid", label: "Not a valid email", emails: ["nope", "bad@"] },
      { reason: "in_database", label: "Already in the database", emails: ["alum@x.com"] },
      {
        reason: "recently_invited",
        label: "Already sent in the last 30 days",
        emails: ["old@x.com"],
      },
    ]);
    expect(groupSkipped([])).toEqual([]);
  });
});
