import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CAPABILITY,
  canCreateEvents,
  canImportEvents,
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
    expect(src).toContain("canCreateEvents");
    expect(src).toContain("ctx.capabilities");
    expect(src).not.toContain("hasFullAccess(");
  });

  it("the bulk-upload wizard page reads events.import", () => {
    const src = read("src/app/(app)/events/import/page.tsx");
    expect(src).toContain("canImportEvents");
    expect(src).toContain("ctx.capabilities");
    expect(src).not.toContain("hasFullAccess(");
  });

  it("the events list resolves the Add-event target from both capabilities", () => {
    const src = read("src/app/(app)/events/page.tsx");
    expect(src).toContain("canCreateEvents(ctx.capabilities)");
    expect(src).toContain("canImportEvents(ctx.capabilities)");
    // Editing / deleting / roster writes stay on the alumni.full tier — the
    // split must not have widened them.
    expect(src).toContain("hasFullAccess(ctx.roles)");
  });

  it("the toolbar takes booleans and holds no permission logic of its own", () => {
    // Two independent flags rather than one href: #611 split the toolbar into a
    // primary "Add event" (the create form) and a secondary CSV import, and
    // each is gated on its own capability, so one destination can't express it.
    const src = read("src/components/events/EventsToolbar.tsx");
    expect(src).toContain("canCreate");
    expect(src).toContain("canImport");
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
