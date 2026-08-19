import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-invariant guards for the "archive the outgoing role" checkbox
 * (api #446).
 *
 * Three things about this control are contracts rather than preferences, and
 * all three break QUIETLY — a wrong payload shape 422s only once someone tries
 * a real save, and a sticky checkbox silently writes fake job history:
 *
 *  1. It DEFAULTS OFF on every load. Archiving is never inferred from the
 *     employer string changing, because a typo correction would then
 *     manufacture a job the alum never left. Nothing may seed this box — no
 *     `defaultChecked`, no entry in `EmploymentDefaults`, nothing from the
 *     profile loader.
 *  2. The flag is TOP LEVEL on the update body. `CareerCreate` is
 *     `extra="forbid"` and its dump goes straight to a column upsert, so a
 *     `career.archive_previous_role` input name would 422 the whole save.
 *  3. It is EDIT-ONLY. The create schema has no such field, so sending it from
 *     "Add alumni" would 422 that form instead.
 *
 * These read source text rather than executing the Next runtime, matching the
 * other structural guards in this repo (see `src/lib/session-invariants.test.ts`).
 */
function read(relPath: string): string {
  // Normalised to LF so the slicing below behaves the same on a Windows
  // checkout (CRLF) as it does in CI.
  return readFileSync(resolve(process.cwd(), relPath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const FORM = "src/components/alumni/edit-sections/EmploymentSectionForm.tsx";
const ACTIONS = "src/app/(app)/alumni/actions.ts";

/** The source of one JSX element, from `<Tag` to its closing `/>`. */
function element(src: string, startsWith: string): string {
  const from = src.indexOf(startsWith);
  expect(from).toBeGreaterThan(-1);
  const to = src.indexOf("/>", from);
  expect(to).toBeGreaterThan(from);
  return src.slice(from, to);
}

/** The body of one top-level function declaration in a module. */
function fn(src: string, name: string): string {
  const from = src.indexOf(`export async function ${name}(`);
  expect(from).toBeGreaterThan(-1);
  const to = src.indexOf("\n}\n", from);
  expect(to).toBeGreaterThan(from);
  return src.slice(from, to);
}

describe("archive_previous_role checkbox (#446)", () => {
  it("the Employment section renders it as a checkbox", () => {
    const src = read(FORM);
    expect(src).toContain('name="archive_previous_role"');
    expect(element(src, "<Checkbox")).toContain('name="archive_previous_role"');
  });

  it("never seeds the box — no defaultChecked, so it loads OFF every time", () => {
    const box = element(read(FORM), "<Checkbox");
    expect(box).not.toContain("defaultChecked");
    expect(box).not.toContain("checked");
  });

  it("keeps the flag out of the section's stored defaults", () => {
    // Anything reaching `EmploymentDefaults` comes from the saved record, which
    // is exactly what must never decide this box.
    expect(read(FORM)).not.toMatch(
      /archive_previous_role\s*:\s*(string|boolean)/,
    );
    expect(
      read("src/app/(app)/alumni/[id]/edit/employment/page.tsx"),
    ).not.toContain("archive_previous_role");
  });

  it("names the input top-level, never under the career prefix", () => {
    expect(read(FORM)).not.toContain("career.archive_previous_role");
  });

  it("sends it top-level on the update body, outside the career section", () => {
    const body = fn(read(ACTIONS), "updateEmploymentSection");
    expect(body).toContain("archive_previous_role");
    // The career section is built from an explicit field list — the flag being
    // in it is the 422.
    const career = body.slice(
      body.indexOf('buildSection(formData, "career"'),
      body.indexOf('buildSection(formData, "contact"'),
    );
    expect(career).not.toContain("archive_previous_role");
  });

  it("omits it entirely when the box is unticked", () => {
    // `compact` drops undefined, so an untouched form sends no such key at all.
    const body = fn(read(ACTIONS), "updateEmploymentSection");
    expect(body).toMatch(
      /formData\.get\("archive_previous_role"\) !== null \? true : undefined/,
    );
    expect(body).toContain("compact({");
  });

  it("stays off the create path, which has no such field", () => {
    const src = read(ACTIONS);
    expect(fn(src, "createAlumni")).not.toContain("archive_previous_role");
    expect(read("src/components/alumni/AlumniForm.tsx")).not.toContain(
      "archive_previous_role",
    );
  });
});
