import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SAMPLE_ALUM } from "./sampleAlumni";
import {
  ENGAGEMENT_SECTION,
  INFO_SECTIONS,
  WaysToHelp,
} from "@/components/survey/survey-screens";
import { SURVEY_FIELD_BY_KEY } from "@/types/survey";
import {
  SURVEY_INDUSTRY_OPTIONS,
  SURVEY_SECONDARY_INDUSTRY_OPTIONS,
} from "@/constants/dropdowns";

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

  it("samples industries the survey dropdowns actually offer (#874)", () => {
    // Both industry fields are dropdowns now. A sample value off the offered
    // list would show staff the "on file, we'll keep it" case instead of an
    // ordinary answer — and "Unknown" is no longer offered at all.
    const industry = SAMPLE_ALUM["employment.current_industry"];
    const secondary = SAMPLE_ALUM["employment.current_industry_secondary"];
    expect(SURVEY_INDUSTRY_OPTIONS).toContain(industry);
    expect(SURVEY_SECONDARY_INDUSTRY_OPTIONS).toContain(secondary);
    expect(secondary).not.toBe(industry);
  });

  it("never surfaces birth_name — maiden names live in middle_name", () => {
    expect(valueFields.some((f) => f.key.includes("birth_name"))).toBe(false);
    expect(SURVEY_FIELD_BY_KEY["profile.birth_name"]).toBeUndefined();
    expect(SAMPLE_ALUM["profile.birth_name"]).toBeUndefined();
  });

  it("shows the comments box in the sample, as an extra rather than a column (#890)", () => {
    // The "Anything else you'd like to share?" box is free text with NO column
    // behind it. So it is deliberately absent from all three lists: it is not a
    // form FIELD (nothing to apply column-by-column), the email cannot offer it
    // "on file" (nothing is on file), and the sample gives it no value (every
    // alum meets it empty). What keeps the sample honest instead is that the
    // preview renders the very screen that carries it.
    const formKeys = [...INFO_SECTIONS, ENGAGEMENT_SECTION].flatMap((s) =>
      s.fields.map((f) => f.key),
    );
    expect(formKeys.some((k) => k.includes("comment"))).toBe(false);
    expect(
      Object.keys(SURVEY_FIELD_BY_KEY).some((k) => k.includes("comment")),
    ).toBe(false);
    expect(Object.keys(SAMPLE_ALUM).some((k) => k.includes("comment"))).toBe(
      false,
    );

    const html = renderToStaticMarkup(
      createElement(WaysToHelp, {
        firstName: "Jordan",
        valueOf: (key: string) => SAMPLE_ALUM[key] ?? "",
        setEdit: () => {},
        links: [],
        setLinks: () => {},
        comments: "",
        setComments: () => {},
        onNeedChanges: () => {},
        onSubmit: () => {},
        submitting: false,
        submitError: null,
      }),
    );
    expect(html).toContain("Anything else you&#x27;d like to share?");

    const preview = readFileSync(
      fileURLToPath(
        new URL(
          "../components/needs-surveying/SurveyPreview.tsx",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    const step = preview.slice(preview.indexOf("<WaysToHelp"));
    expect(step).toContain("comments={comments}");
    expect(step).toContain("setComments={setComments}");
  });
});
