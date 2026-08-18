import { describe, expect, it } from "vitest";

import {
  EDIT_SECTIONS,
  INFO_SECTIONS,
  OPPORTUNITY_LINKS_SECTION_ID,
  type Section,
} from "./survey-screens";

/**
 * The shape of the survey's section list after Amy's 2026-08-06 notes
 * (#646/#649): Residence folded into Personal, LinkedIn moved to Employment,
 * four name fields added, and Personal grouped by `groupLabel` subheadings.
 *
 * These are structural assertions, not rendering ones — the suite runs in Node
 * with no DOM. That is enough for the regressions that actually matter here,
 * all of which are "someone reorganises the list and quietly drops or reorders
 * a field": every one of these fields is a real database column, so a field
 * that disappears from this list is a column alumni can no longer correct.
 */

const byId = (id: string): Section => {
  const section = INFO_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`no section "${id}"`);
  return section;
};

const keysOf = (section: Section) => section.fields.map((f) => f.key);

describe("sections that moved (#649)", () => {
  it("has no standalone Residence section", () => {
    expect(INFO_SECTIONS.map((s) => s.id)).not.toContain("residence");
    expect(EDIT_SECTIONS.map((s) => s.id)).not.toContain("residence");
  });

  it("keeps all three residence columns, inside Personal", () => {
    // The section went away; the DATA must not. These are the columns the map,
    // the region filters and the geocoded search read.
    expect(keysOf(byId("personal"))).toEqual(
      expect.arrayContaining(["contact.city", "contact.state", "contact.country"]),
    );
  });

  it("moves LinkedIn from Personal to Employment", () => {
    expect(keysOf(byId("employment"))).toContain("profile.linkedin_url");
    expect(keysOf(byId("personal"))).not.toContain("profile.linkedin_url");
  });

  it("asks for LinkedIn exactly once across the whole survey", () => {
    const everywhere = EDIT_SECTIONS.flatMap(keysOf).filter(
      (k) => k === "profile.linkedin_url",
    );
    expect(everywhere).toHaveLength(1);
  });
});

describe("the name fields (#646)", () => {
  const personal = byId("personal");

  it("opens Personal with the four alumni-table name columns, in order", () => {
    expect(keysOf(personal).slice(0, 4)).toEqual([
      "profile.first_name",
      "profile.middle_name",
      "profile.last_name",
      "profile.preferred_first_name",
    ]);
  });

  it("labels the middle name to match what the column actually holds", () => {
    // Staff have been recording maiden names in `middle_name`. A bare "Middle
    // name" label invites an alum to "correct" it by deleting the maiden name
    // we hold, so the wording is a product decision, not a caption.
    const middle = personal.fields.find((f) => f.key === "profile.middle_name");
    expect(middle?.label).toBe("Middle or Maiden name");
  });

  it("never surfaces birth_name", () => {
    // There IS an unused `alumni.birth_name` column. Surfacing it would split
    // the same fact across two columns and orphan everything already filed
    // under `middle_name`. Deliberately not asked.
    expect(EDIT_SECTIONS.flatMap(keysOf)).not.toContain("profile.birth_name");
  });
});

describe("Personal's subheadings (#649)", () => {
  const personal = byId("personal");

  it("stays ONE section — grouping is internal, not five menu rows", () => {
    expect(INFO_SECTIONS.filter((s) => s.id === "personal")).toHaveLength(1);
  });

  it("holds seventeen fields", () => {
    // Seventeen, not eighteen: an earlier count kept LinkedIn here, and it has
    // left for Employment.
    expect(personal.fields).toHaveLength(17);
  });

  it("groups them in the agreed order", () => {
    expect(personal.fields.filter((f) => f.groupLabel).map((f) => f.groupLabel)).toEqual([
      "Name",
      "Marriage",
      "Contact",
      "Residence",
      "Personal details",
    ]);
  });

  it("starts each group on its first field, so nothing is ungrouped", () => {
    // A `groupLabel` marks the START of a run; if the very first field lacked
    // one, the fields before the first marker would render under no heading at
    // all — the flat wall this change exists to remove.
    expect(personal.fields[0].groupLabel).toBe("Name");
  });

  it("leads the Marriage group with marital status, beside the spouse names", () => {
    const marriageStart = personal.fields.findIndex(
      (f) => f.groupLabel === "Marriage",
    );
    expect(keysOf(personal).slice(marriageStart, marriageStart + 3)).toEqual([
      "profile.marital_status",
      "profile.spouse_first_name",
      "profile.spouse_last_name",
    ]);
  });

  it("leaves the other sections flat", () => {
    // Grouping earns its complexity on a 17-field section; a 3-field one would
    // just be headings with one row each.
    for (const section of EDIT_SECTIONS.filter((s) => s.id !== "personal")) {
      expect(section.fields.some((f) => f.groupLabel)).toBe(false);
    }
  });
});

describe("the section list as a whole", () => {
  it("has no duplicate keys — one question per column", () => {
    const keys = EDIT_SECTIONS.flatMap(keysOf);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps every key in `table.column` form", () => {
    // The backend whitelist matches on this exact shape; a key that doesn't
    // split cleanly is silently ignored on submit rather than rejected.
    for (const key of EDIT_SECTIONS.flatMap(keysOf)) {
      expect(key).toMatch(/^[a-z]+\.[a-z0-9_]+$/);
    }
  });
});

describe("opportunity links stay out of the field machinery (#441)", () => {
  /**
   * The three-list parity rule (`sample-survey-parity.test.ts`) binds
   * `INFO_SECTIONS`, `SURVEY_FIELDS` and `SAMPLE_ALUM` together because every
   * entry in them is one `table.column` the response pipeline stages and
   * applies. Opportunity links are rows in their OWN table, several per alum,
   * posted to their own endpoint with their own moderation queue — so they are a
   * pseudo-section (like `"photo"`) and must never appear in those lists.
   *
   * Pinned because the failure mode is quiet and the fix is tempting: adding the
   * screen to `EDIT_SECTIONS` would fail the parity test, and "fixing" THAT by
   * inventing a sample value and an email row would make the staff email offer
   * to show an alum "the opportunity link we have on file", which does not
   * exist.
   */
  it("is not a member of either section list", () => {
    for (const list of [INFO_SECTIONS, EDIT_SECTIONS]) {
      expect(list.map((s) => s.id)).not.toContain(OPPORTUNITY_LINKS_SECTION_ID);
    }
  });

  it("contributes no field keys at all", () => {
    const keys = EDIT_SECTIONS.flatMap(keysOf);
    for (const key of keys) {
      expect(key).not.toMatch(/opportunit|link_url|job_link/);
    }
    // The only `link`-ish key in the survey is the LinkedIn column, which IS a
    // real column and stays where #649 put it.
    expect(keys.filter((k) => k.includes("link"))).toEqual([
      "profile.linkedin_url",
    ]);
  });

  it("keeps its own id, distinct from the photo pseudo-section", () => {
    expect(OPPORTUNITY_LINKS_SECTION_ID).toBe("links");
    expect(OPPORTUNITY_LINKS_SECTION_ID).not.toBe("photo");
  });
});
