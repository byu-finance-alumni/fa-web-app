import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EDIT_SECTIONS,
  SURVEY_CHOICE_OPTIONS,
  isCanonicalChoice,
  isValueOnFile,
  validateSurveyField,
  type EditField,
} from "./survey-screens";
import {
  INDUSTRY_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PRIMARY_INDUSTRY_OPTIONS,
  SURVEY_EMPLOYMENT_STATUS_OPTIONS,
} from "@/constants/dropdowns";

/**
 * The survey's controlled vocabularies, and the one distinction the whole
 * feature turns on (api #426).
 *
 * The backend now accepts only canonical values for industry, employment status
 * and marital status on the public survey path, and IGNORES anything else —
 * quietly, returning 200, leaving the column exactly as it was. That is the
 * right disposition for an endpoint that can't safely argue with the public, but
 * it turns the form into a liar: an alum picks "Other", types "Underwater Basket
 * Weaving", is thanked for it, and we throw the answer away.
 *
 * So the FORM refuses it. The trap in doing that is the legacy record: an alum
 * whose industry has been off-list since before the list existed sees their own
 * value in that same box, and blocking THEM from submitting is a worse outcome
 * than the silent-loss bug. Two behaviours, one control:
 *
 *   1. A newly typed off-list value is an ERROR, with a message that says what
 *      to do instead.
 *   2. The off-list value ALREADY ON FILE is not. It submits, it is a no-op
 *      server-side, and it is never rewritten into something more generic.
 *
 * The suite runs in Node with no DOM (see vitest.config.ts), so the rendering is
 * asserted against the pure helpers plus source invariants for the wiring a
 * helper can't cover.
 */

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/survey/survey-screens.tsx"),
  "utf8",
);

const FIELDS: EditField[] = EDIT_SECTIONS.flatMap((s) => s.fields);
const field = (key: string): EditField => {
  const found = FIELDS.find((f) => f.key === key);
  if (!found) throw new Error(`no survey field ${key}`);
  return found;
};

const INDUSTRY = field("employment.current_industry");
const STATUS = field("profile.employment_status");
const MARITAL = field("profile.marital_status");

/** A value nobody's list has ever held — the bug report, verbatim. */
const OFF_LIST = "Underwater Basket Weaving";

describe("a brand-new off-list industry", () => {
  it("is refused at the form instead of being silently dropped", () => {
    const msg = validateSurveyField(INDUSTRY, OFF_LIST, "Investment Banking");
    expect(msg).not.toBeNull();
  });

  it("tells the alum what to do, not just that they're wrong", () => {
    // A message that stops at "that isn't valid" leaves someone stuck in a form
    // they cannot submit: they can't edit our list, only choose differently.
    const msg = validateSurveyField(INDUSTRY, OFF_LIST, "Investment Banking")!;
    expect(msg).toContain("list above");
    expect(msg.toLowerCase()).toContain("closest match");
    // Text only, per UX-UI.md — no icons or emoji smuggled into copy.
    expect(msg).toMatch(/^[\x20-\x7E’—]+$/);
  });

  it("is refused even when the record ALREADY holds a different off-list value", () => {
    // The discrimination that matters. "You have an odd value on file" is not a
    // licence to type a second, different odd value — only the one we sent them
    // back is exempt.
    expect(validateSurveyField(INDUSTRY, "Basket Weaving", OFF_LIST)).not.toBeNull();
  });

  it("is refused when the record holds nothing at all", () => {
    expect(validateSurveyField(INDUSTRY, OFF_LIST, "")).not.toBeNull();
    expect(validateSurveyField(INDUSTRY, OFF_LIST, undefined)).not.toBeNull();
  });
});

describe("the off-list industry already on the alum's record", () => {
  it("submits without complaint — legacy records are never blocked", () => {
    // The failure mode this test exists to prevent: an alumnus who came to fix
    // their phone number being unable to submit because of a value WE gave them.
    expect(validateSurveyField(INDUSTRY, OFF_LIST, OFF_LIST)).toBeNull();
  });

  it("still submits when re-typed with the casing/whitespace drift on file", () => {
    // The server folds case and trims before matching, so a client rule that
    // didn't would refuse values the server would have taken.
    expect(validateSurveyField(INDUSTRY, "  underwater basket weaving ", OFF_LIST)).toBeNull();
    expect(validateSurveyField(INDUSTRY, OFF_LIST, " UNDERWATER BASKET WEAVING")).toBeNull();
  });

  it("is exempt for every controlled vocabulary, not just industry", () => {
    expect(validateSurveyField(STATUS, "Employed", "Employed")).toBeNull();
    expect(validateSurveyField(MARITAL, "Separated", "Separated")).toBeNull();
  });
});

describe("an ordinary pick from the list", () => {
  it("accepts every industry the survey's own dropdown offers", () => {
    // Drift guard: the control offers `PRIMARY_INDUSTRY_OPTIONS` while the rule
    // checks `INDUSTRY_OPTIONS`. If those ever disagree, the survey starts
    // refusing values it is itself offering — the worst possible failure here.
    for (const o of PRIMARY_INDUSTRY_OPTIONS) {
      expect(validateSurveyField(INDUSTRY, o, "")).toBeNull();
    }
  });

  it("accepts the industries the dropdown HIDES but the record may hold", () => {
    // Law, Corporate Banking, Sales and Trading and Credit Risk are hidden from
    // the primary dropdown (#452) yet are legitimate stored values the server
    // writes. Validating against the offered list rather than the accepted one
    // would refuse an alum for handing back the exact value we sent them.
    for (const o of ["Law", "Corporate Banking", "Sales and Trading", "Credit Risk"]) {
      expect(INDUSTRY_OPTIONS).toContain(o);
      expect(validateSurveyField(INDUSTRY, o, "")).toBeNull();
    }
  });

  it("accepts the literal Other, which IS a canonical industry", () => {
    expect(validateSurveyField(INDUSTRY, "Other", "")).toBeNull();
  });

  it("accepts a canonical value in any casing, as the server does", () => {
    expect(validateSurveyField(INDUSTRY, "investment banking", "")).toBeNull();
    expect(validateSurveyField(INDUSTRY, " Private Equity ", "")).toBeNull();
  });

  it("accepts every status and marital option the survey offers", () => {
    for (const o of SURVEY_EMPLOYMENT_STATUS_OPTIONS) {
      expect(validateSurveyField(STATUS, o, "")).toBeNull();
    }
    for (const o of MARITAL_STATUS_OPTIONS) {
      expect(validateSurveyField(MARITAL, o, "")).toBeNull();
    }
  });
});

describe("a blank answer", () => {
  it("is a skipped question, not a bad one", () => {
    // The server treats a blank on these fields as "leave what's on file alone"
    // (`blankable=False`), so clearing the box is a legitimate way out of the
    // error rather than a second complaint — which is exactly what the message
    // offers as the alternative to picking from the list.
    expect(validateSurveyField(INDUSTRY, "", "")).toBeNull();
    expect(validateSurveyField(INDUSTRY, "   ", OFF_LIST)).toBeNull();
    expect(validateSurveyField(STATUS, "", "Employed")).toBeNull();
  });
});

describe("the rule mirrors the server's matcher", () => {
  it("folds case and trims, like `_choice` in survey_responses.py", () => {
    expect(isCanonicalChoice(INDUSTRY_OPTIONS, " private equity ")).toBe(true);
    expect(isCanonicalChoice(INDUSTRY_OPTIONS, OFF_LIST)).toBe(false);
    expect(isCanonicalChoice(INDUSTRY_OPTIONS, "")).toBe(false);
    expect(isCanonicalChoice(INDUSTRY_OPTIONS, "   ")).toBe(false);
  });

  it("never treats a blank as 'the same as what's on file'", () => {
    // Otherwise an empty record would make every blank look like a match, and
    // the exemption would swallow the rule.
    expect(isValueOnFile("", "")).toBe(false);
    expect(isValueOnFile("  ", "")).toBe(false);
    expect(isValueOnFile(OFF_LIST, "")).toBe(false);
    expect(isValueOnFile(OFF_LIST, null)).toBe(false);
    expect(isValueOnFile(OFF_LIST, undefined)).toBe(false);
  });

  it("checks industry against the canonical list, not the offered one", () => {
    expect(SURVEY_CHOICE_OPTIONS.industry).toBe(INDUSTRY_OPTIONS);
    expect(SURVEY_CHOICE_OPTIONS.industry).not.toBe(PRIMARY_INDUSTRY_OPTIONS);
  });

  it("covers every controlled vocabulary the survey renders", () => {
    // A `choice` field on the backend with no entry here is a field that loses
    // answers in silence, which is the bug this suite is about.
    expect(Object.keys(SURVEY_CHOICE_OPTIONS).sort()).toEqual([
      "employmentStatus",
      "industry",
      "maritalStatus",
    ]);
    expect(SURVEY_CHOICE_OPTIONS.employmentStatus).toBe(
      SURVEY_EMPLOYMENT_STATUS_OPTIONS,
    );
    expect(SURVEY_CHOICE_OPTIONS.maritalStatus).toBe(MARITAL_STATUS_OPTIONS);
  });
});

describe("the wiring a pure helper can't cover", () => {
  it("keeps the free-text 'Other' box, which is what preserves legacy values", () => {
    // Deleting the box would "fix" the validation by making the off-list case
    // unreachable — and would take the stored value off the alum's screen with
    // it. The whole design is that the box still shows what we hold.
    const control = SOURCE.slice(SOURCE.indexOf("function IndustryControl"));
    expect(control).toContain('placeholder="Type your industry"');
  });

  it("validates that box on blur, not on every keystroke", () => {
    const control = SOURCE.slice(
      SOURCE.indexOf("function IndustryControl"),
      SOURCE.indexOf("function OtherDesignationsControl"),
    );
    expect(control).toContain("onBlur={onBlur}");
  });

  it("hands the on-file value to the rule everywhere it runs", () => {
    // `validateSurveyField` called WITHOUT the third argument is the regression:
    // it still typechecks, still looks right, and blocks every legacy record
    // from submitting.
    // Every `validateSurveyField(` occurrence and the 160 characters after it —
    // enough to span the argument list however it happens to be wrapped.
    const windows: string[] = [];
    for (
      let i = SOURCE.indexOf("validateSurveyField(");
      i !== -1;
      i = SOURCE.indexOf("validateSurveyField(", i + 1)
    ) {
      windows.push(SOURCE.slice(i, i + 160));
    }
    // The blur handler and the submit gate: the only two places the rule runs.
    const callSites = windows.filter((w) => w.includes("valueOf("));
    expect(callSites).toHaveLength(2);
    for (const c of callSites) {
      expect(c).toContain("onFileValueOf(");
    }
  });

  it("reads the on-file value from the record, never from the working edits", () => {
    // Both callers own the same shape: `valueOf` folds `edits` over `fields`,
    // `onFileValueOf` must not. If it did, a value would always equal itself and
    // the rule would never fire at all.
    for (const path of [
      "src/app/survey/[token]/page.tsx",
      "src/components/needs-surveying/SurveyPreview.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(src).toContain(
        'const onFileValueOf = (key: string) => fields[key] ?? "";',
      );
      expect(src).toContain("onFileValueOf={onFileValueOf}");
    }
  });
});
