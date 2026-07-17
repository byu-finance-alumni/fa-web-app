import { describe, it, expect } from "vitest";
import { withValue } from "./vocab-options";
import {
  PRIMARY_EXCLUDED_INDUSTRIES,
  PRIMARY_INDUSTRY_OPTIONS,
} from "../constants/dropdowns";

describe("withValue", () => {
  it("re-adds a stored value that isn't in the options, first", () => {
    expect(withValue(["a", "b"], "z")).toEqual(["z", "a", "b"]);
  });

  it("leaves the options alone when the value is already offered", () => {
    const options = ["a", "b"];
    expect(withValue(options, "a")).toBe(options);
  });

  it("adds nothing for a blank / nullish value", () => {
    const options = ["a", "b"];
    expect(withValue(options, "")).toBe(options);
    expect(withValue(options, "   ")).toBe(options);
    expect(withValue(options, null)).toBe(options);
    expect(withValue(options, undefined)).toBe(options);
  });

  it("trims the stored value before deciding", () => {
    expect(withValue(["a"], "  a  ")).toEqual(["a"]);
  });
});

/**
 * The PRIMARY industry dropdown hides four industries that some records still
 * legitimately STORE as their primary: the #282 backend migration deliberately
 * skips the conflict rows whose secondary slot was already occupied, and the
 * backend's `validate_industry` still accepts all of INDUSTRIES on write. Those
 * profiles must survive an unrelated edit untouched — not blank, not silently
 * changed. This is the composition the forms actually render.
 */
describe("primary industry dropdown preserves an excluded stored value", () => {
  for (const stored of PRIMARY_EXCLUDED_INDUSTRIES) {
    it(`offers a stored primary of "${stored}" back, selected`, () => {
      const options = withValue(PRIMARY_INDUSTRY_OPTIONS, stored);
      // Present, so the <select> can render it as the current value rather than
      // falling back to the blank "—" option (which would save as empty).
      expect(options).toContain(stored);
      // First, matching withValue's contract.
      expect(options[0]).toBe(stored);
      // And it did NOT become an option for records that don't store it — the
      // base list is still the narrowed one.
      expect(PRIMARY_INDUSTRY_OPTIONS).not.toContain(stored);
    });
  }

  it("adds exactly one option — the stored value, nothing else", () => {
    const options = withValue(PRIMARY_INDUSTRY_OPTIONS, "Law");
    expect(options).toHaveLength(PRIMARY_INDUSTRY_OPTIONS.length + 1);
    expect(options.slice(1)).toEqual([...PRIMARY_INDUSTRY_OPTIONS]);
  });

  it("does not re-add an excluded value for a record that stores something else", () => {
    const options = withValue(PRIMARY_INDUSTRY_OPTIONS, "Consulting");
    for (const excluded of PRIMARY_EXCLUDED_INDUSTRIES) {
      expect(options).not.toContain(excluded);
    }
  });

  it("preserves a stored primary that left the vocabulary entirely", () => {
    // Not one of the four — a term an admin hid, or an imported legacy value.
    expect(withValue(PRIMARY_INDUSTRY_OPTIONS, "Insurance")).toContain(
      "Insurance",
    );
  });
});
