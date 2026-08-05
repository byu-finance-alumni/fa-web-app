import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { NAME_MAX_LEN, validateName } from "./nameValidation";

/**
 * Editable names in the profile Edit → Personal section (#626).
 *
 * The rules themselves are shared with "Add alumni" on purpose: staff can now
 * rename an alumna (marriage being the case that prompted this), and an edit
 * path that accepted values the add path rejects would let a blank or malformed
 * last name into records that the list display and name sort depend on.
 */

describe("validateName", () => {
  it("accepts ordinary names", () => {
    for (const v of ["Jane", "Anne Marie", "O'Brien", "Smith-Jones", "St. Clair"])
      expect(validateName(v)).toBeNull();
  });

  it("accepts non-ASCII letters so international names aren't rejected", () => {
    for (const v of ["Renée", "Müller", "Nguyễn", "Ólafsdóttir"])
      expect(validateName(v)).toBeNull();
  });

  it("rejects digits and punctuation that would be odd in a name", () => {
    for (const v of ["Jane2", "Jane_Doe", "Jane@Doe", "=cmd", "Jane;DROP"])
      expect(validateName(v)).not.toBeNull();
  });

  it("treats a blank as optional by default and required on demand", () => {
    for (const blank of ["", "   "]) {
      expect(validateName(blank)).toBeNull();
      expect(validateName(blank, { required: true })).toBe("Required.");
    }
  });

  it("enforces the backend's 100-character cap", () => {
    expect(validateName("a".repeat(NAME_MAX_LEN))).toBeNull();
    expect(validateName("a".repeat(NAME_MAX_LEN + 1))).not.toBeNull();
  });

  it("trims before validating, so a padded name is still valid", () => {
    expect(validateName("  Jane  ")).toBeNull();
  });
});

/**
 * Structural guards. These read the source rather than the rendered DOM because
 * what matters is which fields the section wires up and how the action sends
 * them — both are decisions that a future edit could silently reverse.
 */

function read(...parts: string[]): string {
  return readFileSync(resolve(process.cwd(), ...parts), "utf8");
}

describe("Personal section name fields", () => {
  const form = read(
    "src/components/alumni/edit-sections/PersonalSectionForm.tsx",
  );

  it("exposes all five name fields", () => {
    for (const name of [
      "first_name",
      "middle_name",
      "last_name",
      "preferred_first_name",
      "birth_name",
    ])
      expect(form).toContain(`name="${name}"`);
  });

  it("does not expose the identity keys, which are not names", () => {
    // net_id is a pre-existing field in this section; byu_id / mst_id are
    // identity keys and must stay out of a rename form.
    for (const name of ["byu_id", "mst_id"])
      expect(form).not.toContain(`name="${name}"`);
  });

  it("keeps birth_name discoverable as the maiden-name field", () => {
    // The whole reason birth_name is here: the backend searches it for every
    // token, so a renamed alumna is still found under her former surname.
    expect(form.toLowerCase()).toContain("maiden");
  });
});

describe("updatePersonalSection payload", () => {
  const actions = read("src/app/(app)/alumni/actions.ts");
  const body = actions.slice(
    actions.indexOf("export async function updatePersonalSection"),
    actions.indexOf("export async function updateGraduateSection"),
  );

  it("sends the legal names only when non-blank, so neither can be nulled", () => {
    for (const name of ["first_name", "last_name"])
      expect(body).toContain(`${name}: getStr(formData, "${name}")`);
  });

  it("sends the optional names as clearable, so a wrong one can be removed", () => {
    for (const name of ["middle_name", "preferred_first_name", "birth_name"])
      expect(body).toContain(`${name}: getClearableStr(formData, "${name}")`);
  });
});
