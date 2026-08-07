import { describe, expect, it } from "vitest";

import { SAMPLE_ALUM } from "./sampleAlumni";
import { INFO_SECTIONS } from "@/components/survey/survey-screens";
import { SURVEY_FIELD_BY_KEY } from "@/types/survey";

/**
 * The SAMPLE SURVEY must reflect the real survey. Standing instruction from
 * Jake, 2026-08-06: "anytime you make changes to the survey make sure it
 * changes the sample to reflect it."
 *
 * Three lists have to agree, and nothing enforced that until this test:
 *
 *  1. `INFO_SECTIONS`  — the form an alum actually fills in.
 *  2. `SURVEY_FIELDS`  — what the EMAIL's "here's what we have on file" block
 *                        may offer (`SurveyMessageEditor`'s column picker).
 *  3. `SAMPLE_ALUM`    — the values both previews render.
 *
 * Adding a field to (1) and forgetting (2) or (3) fails silently and looks
 * fine: the staff preview shows an em dash, and the email preview drops the row
 * entirely because it keeps only fields that have a value. Both read as "that
 * field isn't in the survey", which is how the name and marital-status fields
 * came to be invisible in the email preview after #646/#647 shipped.
 */

// Kinds that render a Yes/No or a tickbox rather than a value. A boolean has
// nothing to pre-fill, so it needs no sample value — see `SAMPLE_ALUM`'s doc.
const VALUELESS_KINDS = new Set(["boolean", "designation"]);

const valueFields = INFO_SECTIONS.flatMap((s) => s.fields).filter(
  (f) => !VALUELESS_KINDS.has(f.kind),
);

describe("sample survey parity with the real survey", () => {
  it("gives every value-bearing form field a sample value", () => {
    const missing = valueFields
      .filter((f) => !SAMPLE_ALUM[f.key])
      .map((f) => `${f.key} (${f.label})`);
    expect(missing, "add these to SAMPLE_ALUM in lib/sampleAlumni.ts").toEqual(
      [],
    );
  });

  it("lets the email offer every field the form asks about", () => {
    const missing = valueFields
      .filter((f) => !SURVEY_FIELD_BY_KEY[f.key])
      .map((f) => `${f.key} (${f.label})`);
    expect(missing, "add these to SURVEY_FIELDS in types/survey.ts").toEqual([]);
  });

  it("keeps the maiden-name label identical in both lists", () => {
    // The label is the product decision here (#646) — maiden names live in
    // middle_name. Two lists disagreeing would show staff one wording and
    // alumni another.
    const onForm = valueFields.find((f) => f.key === "profile.middle_name");
    expect(onForm?.label).toBe("Middle or Maiden name");
    expect(SURVEY_FIELD_BY_KEY["profile.middle_name"]?.label).toBe(
      "Middle or Maiden name",
    );
  });

  it("never surfaces birth_name — maiden names live in middle_name", () => {
    expect(valueFields.some((f) => f.key.includes("birth_name"))).toBe(false);
    expect(SURVEY_FIELD_BY_KEY["profile.birth_name"]).toBeUndefined();
    expect(SAMPLE_ALUM["profile.birth_name"]).toBeUndefined();
  });
});
