import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIGEST_SCHEDULE_NOTE,
  MAX_DIGEST_RECIPIENTS,
  addRecipient,
  digestConfirmation,
  listChanged,
  removeRecipient,
} from "./link-digest-recipients";

/**
 * The job-link digest card (#567): its list rules and its words.
 *
 * The backend is the authority on the list; these rules only let the card say
 * what is wrong before Save. What matters most is that they agree with the
 * backend (so the card never accepts what the API will 422) and that an empty
 * list is never presented as "off".
 */

const CARD = readFileSync(resolve(__dirname, "LinkDigestControl.tsx"), "utf8");
const ACTIONS = readFileSync(
  resolve(__dirname, "../../app/(app)/engineer/maintenance/actions.ts"),
  "utf8",
);

describe("addRecipient", () => {
  it("trims and lowercases what was typed", () => {
    expect(addRecipient([], "  Amy@BYU.edu ")).toEqual({
      ok: true,
      recipients: ["amy@byu.edu"],
    });
  });

  it("keeps the existing order and appends", () => {
    const res = addRecipient(["amy@byu.edu"], "tanya@byu.edu");
    expect(res).toEqual({ ok: true, recipients: ["amy@byu.edu", "tanya@byu.edu"] });
  });

  it.each([
    [""],
    ["   "],
    ["not-an-email"],
    ["amy@byu.edu, tanya@byu.edu"],
    ["Amy <amy@byu.edu>"],
    ["amy@byu"],
  ])("refuses %j with a sentence", (raw) => {
    const res = addRecipient([], raw);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0);
  });

  it("refuses a duplicate, whatever its case", () => {
    expect(addRecipient(["amy@byu.edu"], "AMY@byu.edu").ok).toBe(false);
  });

  it("stops at the backend's cap", () => {
    const full = Array.from(
      { length: MAX_DIGEST_RECIPIENTS },
      (_, i) => `staff${i}@byu.edu`,
    );
    expect(MAX_DIGEST_RECIPIENTS).toBe(10);
    expect(addRecipient(full, "one.more@byu.edu").ok).toBe(false);
  });
});

describe("removeRecipient / listChanged", () => {
  it("removes only the named address", () => {
    expect(removeRecipient(["a@x.com", "b@x.com"], "a@x.com")).toEqual(["b@x.com"]);
  });

  it("notices additions, removals and reorders, and nothing else", () => {
    expect(listChanged(["a@x.com"], ["a@x.com"])).toBe(false);
    expect(listChanged(["a@x.com"], [])).toBe(true);
    expect(listChanged(["a@x.com"], ["a@x.com", "b@x.com"])).toBe(true);
    expect(listChanged(["a@x.com", "b@x.com"], ["b@x.com", "a@x.com"])).toBe(true);
  });
});

describe("the card's words", () => {
  it("says when the digest goes out, in one plain line", () => {
    expect(DIGEST_SCHEDULE_NOTE).toMatch(/once a day/);
    expect(DIGEST_SCHEDULE_NOTE).toMatch(/6pm/);
    expect(DIGEST_SCHEDULE_NOTE).toMatch(/only on days/);
    expect(CARD).toContain("{DIGEST_SCHEDULE_NOTE}");
  });

  it("never calls an empty list 'off' — the per-posting alert takes over", () => {
    expect(digestConfirmation([])).toMatch(/alert the engineer channels/);
    expect(CARD).toMatch(/engineer channels instead/);
  });

  it("confirms how many addresses will get it", () => {
    expect(digestConfirmation(["a@x.com"])).toMatch(/1 address\b/);
    expect(digestConfirmation(["a@x.com", "b@x.com"])).toMatch(/2 addresses/);
  });

  it("warns when the API cannot send mail at all", () => {
    expect(CARD).toContain("state.email_configured");
  });
});

describe("the contract", () => {
  it("uses the generated schema type, so the CI drift guard covers it", () => {
    expect(ACTIONS).toContain('components["schemas"]["OpportunityLinkDigestState"]');
    expect(ACTIONS).toContain('"/admin/opportunity-link-digest"');
  });
});
