import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ENGINEER_SECURITY_HREFS,
  LEAF_HREFS,
  NAV,
  NO_NAV_TOGGLES,
  currentNavToggles,
  getVisibleNav,
  isNavGroupOpen,
  leafHrefs,
  navGroupKey,
  navGroupPanelId,
  resolveActiveHref,
  toggleNavGroup,
  type NavItem,
} from "@/components/shell/nav";
import { ROLE } from "@/constants/roles";

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

const find = (items: readonly NavItem[], label: string): NavItem => {
  const hit = items.find((i) => i.label === label);
  if (!hit) throw new Error(`no nav item labelled "${label}"`);
  return hit;
};

const engineerGroup = (nav: readonly NavItem[] = NAV) => find(nav, "Engineer");
const securityGroup = (nav: readonly NavItem[] = NAV) =>
  find(engineerGroup(nav).children ?? [], "Security");

const labels = (item: NavItem) => (item.children ?? []).map((c) => c.label);

/* ==================================================================== *
 * The Security group
 * ==================================================================== */

describe("the Engineer → Security group", () => {
  it("gathers exactly the incident/abuse screens", () => {
    expect(leafHrefs(securityGroup())).toEqual([
      "/engineer/logins",
      "/engineer/login-failures",
      "/engineer/sessions",
      "/engineer/maintenance",
    ]);
  });

  it("leaves the day-to-day engineer tools as direct children", () => {
    // Permissions is role configuration, Preview is a read-only QA lens,
    // Surveys is campaign operations and Support contacts is error-screen copy
    // — none of them is reached during an incident, so none of them is
    // "Security". Folding them in would make the group mean "engineer stuff".
    expect(labels(engineerGroup())).toEqual([
      "Permissions",
      "Preview as role",
      "Surveys",
      "Security",
      "Support contacts",
    ]);
  });

  it("is a disclosure toggle, not a link — there is no /engineer/security", () => {
    expect(securityGroup().href).toBeUndefined();
    expect(LEAF_HREFS).not.toContain("/engineer/security");
  });

  it("keeps every grouped screen resolvable as an active link", () => {
    // Nesting must not drop the hrefs out of LEAF_HREFS, or the page you are on
    // would stop highlighting — and the group would stop opening itself.
    for (const href of ENGINEER_SECURITY_HREFS) {
      expect(LEAF_HREFS).toContain(href);
      expect(resolveActiveHref(href)).toBe(href);
    }
    // A deeper route inside one of them still resolves to its nav entry.
    expect(resolveActiveHref("/engineer/sessions/42")).toBe(
      "/engineer/sessions",
    );
    // "/engineer/logins" must not swallow "/engineer/login-failures".
    expect(resolveActiveHref("/engineer/login-failures")).toBe(
      "/engineer/login-failures",
    );
  });

  it("changes no route — the flat list and the grouped list hold the same hrefs", () => {
    const engineerHrefs = leafHrefs(engineerGroup()).sort();
    expect(engineerHrefs).toEqual(
      [
        "/engineer/permissions",
        "/engineer/preview",
        "/engineer/surveys",
        "/engineer/logins",
        "/engineer/login-failures",
        "/engineer/sessions",
        "/engineer/maintenance",
        "/engineer/support-contacts",
      ].sort(),
    );
  });
});

/* ==================================================================== *
 * Gating survives the extra level
 * ==================================================================== */

describe("getVisibleNav with a nested group", () => {
  it("gives the engineer the Security group with all four screens", () => {
    const nav = getVisibleNav(ROLE.ENGINEER, true, []);
    expect(leafHrefs(securityGroup(nav))).toHaveLength(4);
  });

  it("hides the whole Engineer section — Security included — from super admins", () => {
    const nav = getVisibleNav(ROLE.SUPER_ADMIN, true, []);
    expect(nav.some((i) => i.label === "Engineer")).toBe(false);
    expect(nav.flatMap(leafHrefs)).not.toContain("/engineer/sessions");
  });

  it("hides it from every lesser role too", () => {
    for (const role of [ROLE.FULL_ACCESS, ROLE.STUDENT, ROLE.VIEW_ONLY]) {
      const nav = getVisibleNav(role, false, []);
      expect(nav.flatMap(leafHrefs)).not.toContain("/engineer/logins");
    }
  });

  it("still drops an emptied group, at any depth", () => {
    // Admin keeps only what the role may see, and disappears when that is
    // nothing — the recursion must not resurrect empty parents.
    const nav = getVisibleNav(ROLE.STUDENT, false, []);
    expect(nav.some((i) => i.label === "Admin")).toBe(false);
    expect(nav.some((i) => i.label === "Manage")).toBe(false);
  });
});

/* ==================================================================== *
 * Open state: route + local toggle, nothing persisted
 * ==================================================================== */

describe("group open state", () => {
  const security = () => securityGroup();
  const key = navGroupKey(["Engineer"], "Security");

  it("opens itself when the current route is inside it", () => {
    for (const href of ENGINEER_SECURITY_HREFS) {
      expect(isNavGroupOpen(security(), key, href, {})).toBe(true);
    }
    // ...including a deeper route under one of them.
    expect(
      isNavGroupOpen(security(), key, resolveActiveHref("/engineer/logins/9"), {}),
    ).toBe(true);
  });

  it("stays closed when the route is elsewhere", () => {
    expect(isNavGroupOpen(security(), key, "/engineer/surveys", {})).toBe(false);
    expect(isNavGroupOpen(security(), key, "/dashboard", {})).toBe(false);
    expect(isNavGroupOpen(security(), key, null, {})).toBe(false);
  });

  it("opens the Engineer parent as well, so the entry is never buried", () => {
    const parentKey = navGroupKey([], "Engineer");
    expect(
      isNavGroupOpen(engineerGroup(), parentKey, "/engineer/maintenance", {}),
    ).toBe(true);
  });

  it("lets an explicit toggle win over the route, either way", () => {
    expect(isNavGroupOpen(security(), key, "/engineer/logins", { [key]: false }))
      .toBe(false);
    expect(isNavGroupOpen(security(), key, "/dashboard", { [key]: true })).toBe(
      true,
    );
  });

  it("toggles each group independently", () => {
    const parentKey = navGroupKey([], "Engineer");
    const toggles = { [key]: false };
    expect(
      isNavGroupOpen(engineerGroup(), parentKey, "/engineer/logins", toggles),
    ).toBe(true);
    expect(isNavGroupOpen(security(), key, "/engineer/logins", toggles)).toBe(
      false,
    );
  });

  it("keys nested groups by their ancestors, so labels cannot collide", () => {
    expect(navGroupKey(["Engineer"], "Security")).toBe("Engineer / Security");
    expect(navGroupKey([], "Security")).not.toBe(
      navGroupKey(["Engineer"], "Security"),
    );
  });

  it("derives a usable DOM id for aria-controls", () => {
    expect(navGroupPanelId("Engineer / Security")).toBe(
      "nav-group-engineer-security",
    );
    expect(navGroupPanelId("Manage")).toBe("nav-group-manage");
    // No stray separators, whatever the label punctuation.
    expect(navGroupPanelId("Engineer / Preview as role!")).toMatch(
      /^nav-group-[a-z0-9-]*[a-z0-9]$/,
    );
  });
});

describe("toggles are route-scoped and never persisted", () => {
  const key = navGroupKey(["Engineer"], "Security");

  it("remembers a toggle for as long as the route stands", () => {
    const next = toggleNavGroup(NO_NAV_TOGGLES, "/engineer/logins", key, false);
    expect(currentNavToggles(next, "/engineer/logins")).toEqual({
      [key]: false,
    });
  });

  it("discards it the moment the route changes", () => {
    // The back button does not remount the shell, so a collapse made on one
    // page must not follow you onto the next and hide its own nav entry.
    const next = toggleNavGroup(NO_NAV_TOGGLES, "/engineer/logins", key, false);
    expect(currentNavToggles(next, "/engineer/sessions")).toEqual({});
    expect(
      isNavGroupOpen(
        securityGroup(),
        key,
        "/engineer/sessions",
        currentNavToggles(next, "/engineer/sessions"),
      ),
    ).toBe(true);
  });

  it("starts empty and never mutates what it was given", () => {
    expect(NO_NAV_TOGGLES.open).toEqual({});
    const before = toggleNavGroup(NO_NAV_TOGGLES, "/dashboard", key, false);
    toggleNavGroup(before, "/dashboard", "Manage", true);
    expect(before.open).toEqual({ [key]: false });
  });

  it("stores nothing outside React state", () => {
    const src = read("src/components/shell/Sidebar.tsx");
    for (const sink of ["localStorage", "sessionStorage", "document.cookie"]) {
      expect(src).not.toContain(sink);
    }
    expect(read("src/components/shell/nav.ts")).not.toContain("localStorage");
  });
});

/* ==================================================================== *
 * Sidebar markup guards
 * ==================================================================== */

describe("the sidebar disclosure markup", () => {
  const src = () => read("src/components/shell/Sidebar.tsx");

  it("uses a real button with aria-expanded and aria-controls", () => {
    expect(src()).toContain('type="button"');
    expect(src()).toContain("aria-expanded={open}");
    expect(src()).toContain("aria-controls={panelId}");
    expect(src()).toContain("id={panelId}");
  });

  it("renders groups recursively, so a nested group is not a special case", () => {
    expect(src()).toContain("renderItem(c, depth + 1");
  });

  it("introduces no per-item icon — the sidebar renders labels only", () => {
    expect(src()).not.toContain("icon:");
  });
});

/* ==================================================================== *
 * The console page agrees with the nav
 * ==================================================================== */

describe("the Engineer console page", () => {
  const src = () => read("src/app/(app)/engineer/page.tsx");

  it("groups its cards off the sidebar's Security group, not a second list", () => {
    expect(src()).toContain("ENGINEER_SECURITY_HREFS");
    expect(src()).toContain('title: "Security"');
  });

  it("has a card for every screen in the Security group", () => {
    const page = src();
    for (const href of ENGINEER_SECURITY_HREFS) {
      expect(page).toContain(`href: "${href}"`);
    }
  });

  it("still links every engineer screen the nav lists", () => {
    const page = src();
    for (const href of leafHrefs(engineerGroup())) {
      expect(page).toContain(`href: "${href}"`);
    }
  });
});
