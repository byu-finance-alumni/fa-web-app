import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MARITAL_STATUS_KEY,
  MARITAL_STATUS_OPTIONS,
  SPOUSE_CLEAR_PROMPT_STATUSES,
  SPOUSE_FIRST_NAME_KEY,
  SPOUSE_LAST_NAME_KEY,
  shouldPromptSpouseClear,
  withStoredValue,
} from "./survey-screens";

/**
 * Marital status as a dropdown (#647), and the spouse name it sits next to.
 *
 * Two behaviours are load-bearing here and neither is obvious from reading the
 * component, which is why they're pinned:
 *   1. A stored value that isn't one of the canonical four still displays. The
 *      column was free text for years; a controlled list that blanks what it
 *      doesn't recognise turns "the alum corrected their phone number" into
 *      "we lost their marital status".
 *   2. Changing the status NEVER clears a spouse name on its own, and Widowed
 *      never even asks.
 *
 * The suite runs in Node with no DOM (see vitest.config.ts), so the rendering
 * is asserted against the pure helpers the component delegates to, plus source
 * invariants for the wiring a helper can't cover.
 */

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/survey/survey-screens.tsx"),
  "utf8",
);

describe("the marital-status option list", () => {
  it("offers exactly the canonical four, in order", () => {
    expect([...MARITAL_STATUS_OPTIONS]).toEqual([
      "Single",
      "Married",
      "Divorced",
      "Widowed",
    ]);
  });

  it("renders as a dropdown, not free text", () => {
    // The regression: reverting the field to `kind: "text"`, which is the state
    // staff reported as the question being "missing" altogether.
    expect(SOURCE).toContain(
      `{ key: MARITAL_STATUS_KEY, label: "Marital status", kind: "maritalStatus"`,
    );
    expect(SOURCE).toContain("options={MARITAL_STATUS_OPTIONS}");
  });

  it("goes through the shared select, which preserves an off-list value", () => {
    // Pinned as SOURCE too: swapping SelectControl for a bare <select> would
    // still typecheck and still look right, and would silently drop every
    // stored value outside the four.
    const control = SOURCE.slice(SOURCE.indexOf('field.kind === "maritalStatus"'));
    expect(control.slice(0, control.indexOf('field.kind === "industry"'))).toContain(
      "<SelectControl",
    );
  });
});

describe("a stored marital status that isn't on the list", () => {
  it("is still offered, first, so the dropdown shows it", () => {
    // "Separated" is the realistic case: a real answer someone typed into the
    // free-text box that the canonical four don't cover.
    expect(withStoredValue(MARITAL_STATUS_OPTIONS, "Separated")).toEqual([
      "Separated",
      "Single",
      "Married",
      "Divorced",
      "Widowed",
    ]);
  });

  it("is never duplicated when it IS on the list", () => {
    expect(withStoredValue(MARITAL_STATUS_OPTIONS, "Married")).toEqual([
      ...MARITAL_STATUS_OPTIONS,
    ]);
  });

  it("leaves an empty stored value alone (no blank option smuggled in)", () => {
    expect(withStoredValue(MARITAL_STATUS_OPTIONS, "")).toEqual([
      ...MARITAL_STATUS_OPTIONS,
    ]);
  });

  it("preserves casing drift rather than normalising it away", () => {
    // The column is a plain varchar with no write validation, so production
    // holds "married" as well as "Married". Showing it back exactly as stored
    // is the point — we are not here to quietly rewrite the record.
    expect(withStoredValue(MARITAL_STATUS_OPTIONS, "married")[0]).toBe("married");
  });
});

describe("changing marital status with a spouse name on file", () => {
  it("asks before removing it when the new status says there's no spouse", () => {
    expect(shouldPromptSpouseClear("Single", "Taylor", "Avery")).toBe(true);
    expect(shouldPromptSpouseClear("Divorced", "Taylor", "Avery")).toBe(true);
  });

  it("asks when only one half of the name is on file", () => {
    expect(shouldPromptSpouseClear("Divorced", "Taylor", "")).toBe(true);
    expect(shouldPromptSpouseClear("Divorced", "", "Avery")).toBe(true);
  });

  it("says nothing when Married — the name is expected", () => {
    expect(shouldPromptSpouseClear("Married", "Taylor", "Avery")).toBe(false);
  });

  it("says nothing when there is no spouse name to lose", () => {
    expect(shouldPromptSpouseClear("Divorced", "", "")).toBe(false);
    expect(shouldPromptSpouseClear("Divorced", "  ", " ")).toBe(false);
    expect(shouldPromptSpouseClear("Divorced", null, undefined)).toBe(false);
  });

  it("says nothing when the status was merely cleared", () => {
    // Blanking the dropdown asserts nothing about a spouse.
    expect(shouldPromptSpouseClear("", "Taylor", "Avery")).toBe(false);
    expect(shouldPromptSpouseClear("   ", "Taylor", "Avery")).toBe(false);
  });

  it("says nothing for a status it doesn't recognise", () => {
    // Whitelist, not "anything except Married": a prompt about deleting a
    // spouse is only acceptable when we're sure the answer contradicts it.
    expect(shouldPromptSpouseClear("Separated", "Taylor", "Avery")).toBe(false);
    expect(shouldPromptSpouseClear("It's complicated", "Taylor", "Avery")).toBe(false);
  });

  it("matches the status case-insensitively", () => {
    expect(shouldPromptSpouseClear("divorced", "Taylor", "Avery")).toBe(true);
    expect(shouldPromptSpouseClear(" SINGLE ", "Taylor", "Avery")).toBe(true);
  });
});

describe("Widowed — the exception that must never be 'fixed'", () => {
  /**
   * Many widows deliberately keep their spouse on the record. A form asking
   * whether they'd like to delete their late spouse's name, in the middle of a
   * two-minute admin task, is a genuinely bad moment to hand someone.
   *
   * This is the test that exists to stop a later tidy-up from making Widowed
   * "consistent" with Single and Divorced. It is not consistent on purpose.
   */
  it("never prompts, however much spouse data is on file", () => {
    expect(shouldPromptSpouseClear("Widowed", "Taylor", "Avery")).toBe(false);
    expect(shouldPromptSpouseClear("widowed", "Taylor", "Avery")).toBe(false);
    expect(shouldPromptSpouseClear(" Widowed ", "Taylor", "")).toBe(false);
    expect(shouldPromptSpouseClear("Widowed", "", "Avery")).toBe(false);
  });

  it("is absent from the prompt whitelist entirely", () => {
    expect(SPOUSE_CLEAR_PROMPT_STATUSES).not.toContain("Widowed");
    expect(
      SPOUSE_CLEAR_PROMPT_STATUSES.some((s) => s.toLowerCase() === "widowed"),
    ).toBe(false);
    // And the whitelist is exactly the two statuses that assert no spouse.
    expect([...SPOUSE_CLEAR_PROMPT_STATUSES]).toEqual(["Single", "Divorced"]);
  });
});

describe("clearing the spouse name", () => {
  it("only ever happens from the prompt's own Remove button", () => {
    // The destructive half of this feature is two `setEdit(..., "")` calls. If
    // they ever move somewhere that runs without a click — an effect, the
    // change handler itself — a dropdown change starts wiping spouse names
    // silently, which is the exact behaviour this design rejects.
    const clears = SOURCE.match(/setEdit\(SPOUSE_(?:FIRST|LAST)_NAME_KEY, ""\)/g);
    expect(clears).toHaveLength(2);
    const handler = SOURCE.slice(
      SOURCE.indexOf("const onFieldChange"),
      SOURCE.indexOf("// A specific section (or the photo screen) is open."),
    );
    expect(handler).not.toContain('setEdit(SPOUSE_FIRST_NAME_KEY, ""');
    expect(handler).not.toContain('setEdit(SPOUSE_LAST_NAME_KEY, ""');
    // Both clears sit in the SpouseNamePrompt's onClear handler.
    const onClear = SOURCE.slice(SOURCE.indexOf("onClear={() => {"));
    expect(onClear.slice(0, onClear.indexOf("}}"))).toContain(
      'setEdit(SPOUSE_FIRST_NAME_KEY, "")',
    );
  });

  it("keeps the three keys it spans pointed at the real columns", () => {
    expect(MARITAL_STATUS_KEY).toBe("profile.marital_status");
    expect(SPOUSE_FIRST_NAME_KEY).toBe("profile.spouse_first_name");
    expect(SPOUSE_LAST_NAME_KEY).toBe("profile.spouse_last_name");
  });
});
