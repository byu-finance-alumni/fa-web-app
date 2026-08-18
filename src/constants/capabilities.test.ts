import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CAPABILITY,
  canAddInteraction,
  canArchiveAlumni,
  canCreateAlumni,
  canCreateEvents,
  canExportAlumni,
  canImportAlumni,
  canImportEvents,
  canManageEvents,
  canDeleteLinks,
  canManageHeadshots,
  canManageSurveys,
  canViewDonations,
  canWriteNotes,
  hasCapability,
} from "./capabilities";

/**
 * Event authoring capabilities (fa-web-api #378).
 *
 * Two halves:
 *
 *  1. the predicates themselves — including that the two capabilities are
 *     genuinely independent, which is the whole reason they were split;
 *  2. source-invariant guards over the three event screens, pinning that they
 *     gate on the CAPABILITY and not on `hasFullAccess`. That regression is easy
 *     to reintroduce and invisible until an engineer grants `events.create` to a
 *     narrower role and the button stays hidden from someone the backend would
 *     let through.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("capability predicates", () => {
  it("codes match the backend registry", () => {
    expect(CAPABILITY.EVENTS_CREATE).toBe("events.create");
    expect(CAPABILITY.EVENTS_IMPORT).toBe("events.import");
  });

  it("hasCapability treats missing capabilities as denied", () => {
    expect(hasCapability(undefined, CAPABILITY.EVENTS_CREATE)).toBe(false);
    expect(hasCapability(null, CAPABILITY.EVENTS_CREATE)).toBe(false);
    expect(hasCapability([], CAPABILITY.EVENTS_CREATE)).toBe(false);
  });

  it("recognises each event capability", () => {
    expect(canCreateEvents(["view", "events.create"])).toBe(true);
    expect(canImportEvents(["view", "events.import"])).toBe(true);
  });

  it("the two capabilities are independent", () => {
    // Mirrors the backend tests: neither implies the other.
    expect(canImportEvents(["view", "events.create"])).toBe(false);
    expect(canCreateEvents(["view", "events.import"])).toBe(false);
  });

  it("does not infer event access from the alumni.full capability", () => {
    // The split is the point — holding the old blanket capability alone must
    // not light up the event controls.
    expect(canCreateEvents(["view", "alumni.edit", "alumni.full"])).toBe(false);
    expect(canImportEvents(["view", "alumni.edit", "alumni.full"])).toBe(false);
  });
});

describe("event screens gate on capabilities, not roles (#378)", () => {
  it("the add-event form reads events.create", () => {
    const src = read("src/app/(app)/events/new/page.tsx");
    expect(src).toContain("canCreateEvents(ctx.capabilities)");
    // The gate that decides whether the form renders at all must be the
    // capability. A role check here is the regression: it bounces someone an
    // engineer has granted events.create.
    expect(src).not.toMatch(/canCreate\s*=\s*hasFullAccess/);
    expect(src).not.toContain("hasFullAccess(ctx.roles) && ");
    // The page may still ask about the alumni.full tier for a DIFFERENT
    // question — whether to offer "take me to the attendee upload next", which
    // the backend guards with require_full_access (#611). That never gates
    // creating the event.
    if (src.includes("hasFullAccess(")) {
      expect(src).toContain("canUploadAttendees = hasFullAccess(ctx.roles)");
    }
  });

  it("the bulk-upload wizard page reads events.import", () => {
    const src = read("src/app/(app)/events/import/page.tsx");
    expect(src).toContain("canImportEvents");
    expect(src).toContain("ctx.capabilities");
    expect(src).not.toContain("hasFullAccess(");
  });

  it("the events list gates each Add-event action on its own capability", () => {
    const src = read("src/app/(app)/events/page.tsx");
    expect(src).toContain("canCreateEvents(ctx.capabilities)");
    expect(src).toContain("canImportEvents(ctx.capabilities)");
    // Editing / deleting / roster writes and note-writing moved off the role
    // check onto their own capabilities in #379 — they must not read the role.
    expect(src).toContain("canManageEventsCap(ctx.capabilities)");
    expect(src).toContain("canWriteNotesCap(ctx.capabilities)");
    expect(src).not.toContain("hasFullAccess");
  });

  it("the toolbar takes hrefs and holds no permission logic of its own", () => {
    const src = read("src/components/events/EventsToolbar.tsx");
    // Two separate destinations (#611): one prop let the CSV importer win the
    // "Add event" label whenever the viewer happened to hold events.import.
    expect(src).toContain("createHref");
    expect(src).toContain("importHref");
    expect(src).not.toContain("hasFullAccess");
    expect(src).not.toContain("canManageEvents");
  });
});

describe("the permission editor stays data-driven (#378)", () => {
  // The two new capabilities appear in the engineer's permissions screen with
  // no frontend change ONLY because the matrix is rendered from the backend
  // registry. A hardcoded capability list here would silently drop new rows.
  it("renders every capability the backend returns", () => {
    const src = read("src/components/engineer/PermissionEditor.tsx");
    expect(src).toContain("matrix.capabilities.map");
    expect(src).not.toMatch(/["']alumni\.full["']/);
  });

  it("the read-only Users table renders every assignable capability", () => {
    const src = read("src/components/admin/RoleCapabilitiesTable.tsx");
    expect(src).toContain("matrix.capabilities.filter");
    expect(src).not.toMatch(/["']alumni\.full["']/);
  });
});


/**
 * The #379 split of `alumni.full` into per-section capabilities.
 *
 * Same two halves as above: the predicates, then source-invariant guards over
 * every screen that used to stand in for the blanket capability with a
 * `hasFullAccess(ctx.roles)` role check. Those checks are the regression that
 * makes a permission toggle look broken — the engineer grants `alumni.import`
 * to a role, the backend lets it through, and the page still redirects.
 */
describe("the #379 per-section capabilities", () => {
  it("codes match the backend registry", () => {
    expect(CAPABILITY.INTERACTIONS_CREATE).toBe("interactions.create");
    expect(CAPABILITY.ALUMNI_CREATE).toBe("alumni.create");
    expect(CAPABILITY.ALUMNI_ARCHIVE).toBe("alumni.archive");
    expect(CAPABILITY.ALUMNI_IMPORT).toBe("alumni.import");
    expect(CAPABILITY.ALUMNI_EXPORT).toBe("alumni.export");
    expect(CAPABILITY.ALUMNI_PHOTOS).toBe("alumni.photos");
    expect(CAPABILITY.EVENTS_MANAGE).toBe("events.manage");
    expect(CAPABILITY.NOTES_MANAGE).toBe("notes.manage");
    expect(CAPABILITY.SURVEYS_MANAGE).toBe("surveys.manage");
    expect(CAPABILITY.DONATIONS_VIEW).toBe("donations.view");
    expect(CAPABILITY.REPORTS_ADVANCED).toBe("reports.advanced");
  });

  it("each predicate reads only its own code", () => {
    const predicates = [
      [canAddInteraction, CAPABILITY.INTERACTIONS_CREATE],
      [canCreateAlumni, CAPABILITY.ALUMNI_CREATE],
      [canArchiveAlumni, CAPABILITY.ALUMNI_ARCHIVE],
      [canImportAlumni, CAPABILITY.ALUMNI_IMPORT],
      [canExportAlumni, CAPABILITY.ALUMNI_EXPORT],
      [canManageHeadshots, CAPABILITY.ALUMNI_PHOTOS],
      [canManageEvents, CAPABILITY.EVENTS_MANAGE],
      [canWriteNotes, CAPABILITY.NOTES_MANAGE],
      [canViewDonations, CAPABILITY.DONATIONS_VIEW],
    ] as const;
    for (const [predicate, code] of predicates) {
      expect(predicate(["view", code])).toBe(true);
      // The retired blanket capability must not imply any of them, or the
      // split bought nothing.
      expect(predicate(["view", "alumni.edit", "alumni.full"])).toBe(false);
    }
  });

  it("importing and exporting are independent", () => {
    // The two bulk doors, in opposite directions — granting one must never
    // grant the other.
    expect(canExportAlumni(["view", "alumni.import"])).toBe(false);
    expect(canImportAlumni(["view", "alumni.export"])).toBe(false);
  });

  it("logging an interaction does not imply editing an alumnus", () => {
    expect(canAddInteraction(["view", "interactions.create"])).toBe(true);
    expect(canCreateAlumni(["view", "interactions.create"])).toBe(false);
    expect(canArchiveAlumni(["view", "interactions.create"])).toBe(false);
  });
});

describe("screens gate on the #379 capabilities, not roles", () => {
  const CASES: [string, string][] = [
    ["src/app/(app)/admin/import/page.tsx", "canImportAlumni"],
    ["src/app/(app)/admin/import/update/page.tsx", "canImportAlumni"],
    ["src/app/(app)/friends/import/page.tsx", "canImportAlumni"],
    ["src/app/(app)/alumni/new/page.tsx", "canCreateAlumni"],
    ["src/app/(app)/pay-it-forward/page.tsx", "canViewDonations"],
    ["src/app/(app)/events/[id]/edit/page.tsx", "canManageEventsCap"],
    ["src/app/(app)/events/[id]/attendees/import/page.tsx", "canManageEventsCap"],
  ];

  it.each(CASES)("%s reads %s from the capability list", (path, predicate) => {
    const src = read(path);
    expect(src).toContain(`${predicate}(ctx.capabilities)`);
    expect(src).not.toContain("hasFullAccess");
  });

  it("the alumni profile splits archive / photos / export / notes apart", () => {
    const src = read("src/app/(app)/alumni/[id]/page.tsx");
    expect(src).toContain("canArchiveAlumni(ctx.capabilities)");
    expect(src).toContain("canManageHeadshots(ctx.capabilities)");
    expect(src).toContain("canExportAlumni(ctx.capabilities)");
    expect(src).toContain("canWriteNotesCap(ctx.capabilities)");
    expect(src).toContain("canAddInteraction(ctx.capabilities)");
    expect(src).not.toContain("hasFullAccess(");
  });

  it("the roster reads create + interaction from capabilities", () => {
    const src = read("src/components/alumni/AlumniRoster.tsx");
    expect(src).toContain("canCreateAlumni(caps)");
    expect(src).toContain("canAddInteraction(caps)");
    expect(src).not.toContain("hasFullAccess");
  });

  it("the sidebar nav is capability-gated, with no full-access role flag", () => {
    const src = read("src/components/shell/nav.ts");
    // The blanket role flag is gone; every Manage/Activity item names a code.
    expect(src).not.toContain("fullAccessOnly?:");
    expect(src).toContain("CAPABILITY.ALUMNI_IMPORT");
    expect(src).toContain("CAPABILITY.REPORTS_ADVANCED");
    expect(src).toContain("CAPABILITY.SURVEYS_MANAGE");
    expect(src).toContain("CAPABILITY.DONATIONS_VIEW");
  });

  it("the app shell passes the effective capabilities to the sidebar", () => {
    // Without this the nav would silently fall back to hiding everything.
    const src = read("src/app/(app)/layout.tsx");
    expect(src).toContain("capabilities={capabilities}");
    // ...and must NOT leak the engineer's own capabilities while previewing a
    // lower role, exactly as canVocab already does.
    expect(src).toContain("previewRole ? [] : realCapabilities");
  });
});


/**
 * `links.delete` — deleting an opportunity link (fa-web-api, Links tab).
 *
 * Its own capability rather than a stronger reading of `surveys.manage`, and
 * the tests below are mostly about that one fact. Approve and reject are
 * reversible bookkeeping on a moderation queue; delete destroys the row. Full
 * Access keeps the first pair and does NOT get the second, so a UI that inferred
 * delete from review would hand a destructive control to a whole tier the
 * backend then 403s — the exact "permission toggle looks broken" failure #379
 * was about, pointing the other way.
 */
describe("the links.delete capability", () => {
  it("matches the code the backend registers", () => {
    expect(CAPABILITY.LINKS_DELETE).toBe("links.delete");
  });

  it("reads only its own code", () => {
    expect(canDeleteLinks(["view", "links.delete"])).toBe(true);
    expect(canDeleteLinks(["view"])).toBe(false);
    expect(canDeleteLinks([])).toBe(false);
    expect(canDeleteLinks(null)).toBe(false);
    expect(canDeleteLinks(undefined)).toBe(false);
  });

  it("is not implied by surveys.manage, and does not imply it", () => {
    // The Full Access shape: reviews links, cannot delete them.
    expect(canDeleteLinks(["view", "surveys.manage"])).toBe(false);
    expect(canManageSurveys(["view", "links.delete"])).toBe(false);
    // Super Admin / Engineer hold both.
    expect(canDeleteLinks(["view", "surveys.manage", "links.delete"])).toBe(true);
    expect(canManageSurveys(["view", "surveys.manage", "links.delete"])).toBe(
      true,
    );
  });

  it("is not implied by the retired blanket capability", () => {
    expect(canDeleteLinks(["view", "alumni.edit", "alumni.full"])).toBe(false);
  });
});

describe("the Links tab gates deletion on the capability, not a role", () => {
  it("the list page reads links.delete and fails closed", () => {
    const src = read("src/app/(app)/links/page.tsx");
    expect(src).toContain("canDeleteLinks(capabilities)");
    expect(src).toMatch(/catch \{[\s\S]*?canDelete = false;[\s\S]*?\}/);
    expect(src).not.toContain("hasFullAccess");
    expect(src).not.toContain("super_admin");
  });

  it("no delete control exists outside a capability check", () => {
    // The button, the checkboxes and the Delete action all hang off the
    // selection context, whose `canDelete` is the capability. Nothing may
    // shortcut it.
    const src = read("src/components/links/LinksSelection.tsx");
    expect(src).toContain("canDelete");
    expect(src).toContain("active: canDelete && active");
    expect(src).not.toContain("hasFullAccess");
    expect(src).not.toContain("roles");
  });
});
