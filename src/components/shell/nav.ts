import { ROLE } from "@/constants/roles";
import { CAPABILITY, hasCapability } from "@/constants/capabilities";

/**
 * Shared navigation model for the app shell — consumed by both the desktop
 * `Sidebar` and the mobile "More" menu so the two never drift. Gating legend
 * (see `getVisibleNav`):
 *   (no flag)      → every role
 *   hideViewOnly   → student and up (hidden from view_only / "Professor")
 *   capability     → holders of that capability code (see @/constants/capabilities)
 *   superAdminOnly → super_admin, engineer
 *   vocabOnly      → holders of the vocab_admin capability (engineer + granted)
 *   engineerOnly   → engineer only
 *
 * There is deliberately NO `fullAccessOnly` flag any more: fa-web-api #379
 * dissolved the blanket `alumni.full` capability into per-section codes, and a
 * role check would hide a screen from a role the engineer has deliberately
 * granted, making the permission toggle look broken. Gate on `capability`.
 */

/** Gating flags — shared by leaves and groups, so a whole group can be gated. */
type NavGating = {
  /** Capability code required to see this item (fa-web-api #379). */
  capability?: string;
  superAdminOnly?: boolean;
  engineerOnly?: boolean;
  vocabOnly?: boolean;
  hideViewOnly?: boolean;
};

/** A navigable entry. `children` is declared (as `undefined`) so a plain
 *  `item.children ? … : …` narrows the union in both directions. */
export type NavLeaf = NavGating & {
  href: string;
  label: string;
  children?: undefined;
};

/**
 * A collapsible section. Groups are toggles, never links — `href` is only the
 * section root for the older top-level groups and is deliberately optional, so
 * a purely organisational group (Engineer → Security) does not have to invent a
 * route that does not exist.
 *
 * Groups nest: `children` is `NavItem[]`, not `NavLeaf[]`.
 */
export type NavGroup = NavGating & {
  href?: string;
  label: string;
  children: NavItem[];
};

export type NavItem = NavLeaf | NavGroup;

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  // EXPERIMENT (experiment/top-nav): eleven top-level entries fitted down a
  // sidebar, where vertical space is cheap and a long list reads fine. Across a
  // bar they crowd, and "Internship Links" wrapped to two lines on a 1900px
  // screen. Regrouped to eight, on ONE rule: an entry stays top-level if it is
  // somewhere staff work out of daily, and moves into a group if it is a place
  // they visit for a reason.
  //
  // Nothing is hidden and no route changed — `LEAF_HREFS` is identical, so
  // every gate, redirect and active-route test still describes the same set.
  {
    href: "/alumni",
    label: "People",
    children: [
      { href: "/alumni", label: "Alumni" },
      { href: "/friends", label: "Friends" },
    ],
  },
  { href: "/events", label: "Events" },
  // Opportunity links (api #441). Stays top-level — a browsing surface staff
  // work out of, not a one-off admin task — and keeps the owner's wording. It
  // wrapped to two lines in the bar; that is fixed with `whitespace-nowrap` in
  // TopNav rather than by shortening a label he chose deliberately (a test in
  // opportunityLinks.test.ts pins it, which is how I found out).
  {
    href: "/links",
    label: "Internship Links",
    capability: CAPABILITY.SURVEYS_MANAGE,
  },
  // Map, Statistics and Activity are all "go and look at the shape of the data",
  // which is a reason to visit rather than a place to work — so they group.
  {
    label: "Insights",
    children: [
      { href: "/map", label: "Map" },
      { href: "/statistics", label: "Statistics" },
      {
        href: "/activity",
        label: "Activity",
        capability: CAPABILITY.REPORTS_ADVANCED,
      },
    ],
  },

  {
    // No gate on the group itself — `getVisibleNav` drops it when none of its
    // children survive, so the section appears for exactly the roles that hold
    // at least one of the capabilities below.
    href: "/manage",
    label: "Manage",
    children: [
      { href: "/tasks", label: "Tasks", capability: CAPABILITY.REPORTS_ADVANCED },
      {
        href: "/needs-surveying",
        label: "Needs Surveying",
        capability: CAPABILITY.SURVEYS_MANAGE,
      },
      {
        href: "/pay-it-forward",
        label: "Pay It Forward",
        capability: CAPABILITY.DONATIONS_VIEW,
      },
      {
        href: "/data-quality",
        label: "Data quality",
        capability: CAPABILITY.REPORTS_ADVANCED,
      },
      {
        href: "/admin/import",
        label: "Import",
        capability: CAPABILITY.ALUMNI_IMPORT,
      },
      {
        href: "/admin/import/update",
        label: "Update",
        capability: CAPABILITY.ALUMNI_IMPORT,
      },
    ],
  },

  {
    href: "/admin",
    label: "Admin",
    children: [
      { href: "/admin", label: "Users", superAdminOnly: true },
      { href: "/audit", label: "Audit", superAdminOnly: true },
      { href: "/vocabulary", label: "Vocabulary", vocabOnly: true },
    ],
  },
  {
    href: "/engineer",
    label: "Engineer",
    engineerOnly: true,
    children: [
      { href: "/engineer/permissions", label: "Permissions", engineerOnly: true },
      { href: "/engineer/preview", label: "Preview as role", engineerOnly: true },
      { href: "/engineer/surveys", label: "Surveys", engineerOnly: true },
      {
        // The incident/abuse cluster, gathered out of the flat Engineer list.
        // These four answer one question — who got in, who tried, who is in
        // right now, and how do I shut the doors — and they are the screens
        // reached under time pressure, so they read better as one named place
        // than as four siblings of the day-to-day config tools.
        //
        // Deliberately NOT in here: Permissions (role configuration, changed on
        // an ordinary working day, not during an incident), Preview as role (a
        // read-only QA lens), Surveys (campaign operations) and Support contacts
        // (error-screen content). Folding those in would make "Security" mean
        // "engineer stuff", which is what the Engineer group already means.
        //
        // No `href`: there is no /engineer/security route and there must not
        // appear to be one — the header is a disclosure toggle, not a link.
        label: "Security",
        engineerOnly: true,
        children: [
          { href: "/engineer/logins", label: "Logins", engineerOnly: true },
          {
            href: "/engineer/login-failures",
            label: "Login failures",
            engineerOnly: true,
          },
          // Who is signed in RIGHT NOW, and the control to end it. Sits with the
          // two sign-in logs because it answers the same class of question, but
          // it is an inventory rather than a history — and it is the only one of
          // the three that can act, not just report.
          { href: "/engineer/sessions", label: "Sessions", engineerOnly: true },
          // The site-wide pause — and the home of the automatic IP blocks and
          // the login-attack table. It was reachable only from the /engineer
          // console page or by typing the URL, which is the wrong place for a
          // kill switch: it is wanted during an incident, when nobody is
          // browsing a card grid.
          {
            href: "/engineer/maintenance",
            label: "Maintenance mode",
            engineerOnly: true,
          },
        ],
      },
      {
        href: "/engineer/support-contacts",
        label: "Support contacts",
        engineerOnly: true,
      },
    ],
  },
];

/** Every navigable leaf href beneath `item` — group headers are toggles, not
 *  links, so a group contributes its descendants and never itself. */
export const leafHrefs = (item: NavItem): string[] =>
  item.children ? item.children.flatMap(leafHrefs) : [item.href];

/** Every navigable leaf href, plus the standalone privacy link — for resolving
 *  the active nav item. */
export const LEAF_HREFS: string[] = [...NAV.flatMap(leafHrefs), "/privacy"];

/** The active link is the LONGEST leaf href the current path matches (exact, or
 *  as a "/parent/…" prefix) — so a deeper route wins over a shorter prefix. */
export const resolveActiveHref = (pathname: string): string | null =>
  LEAF_HREFS.reduce<string | null>((best, href) => {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) return best;
    return best === null || href.length > best.length ? href : best;
  }, null);

/* ==================================================================== *
 * Group open/closed state
 *
 * Nothing here is persisted — no storage, no cookie. A group's open state is
 * derived from exactly two things: whether the current route lives inside it,
 * and whether the user has toggled it since arriving on this route.
 * ==================================================================== */

/** Stable identity for a group, unique across the tree — a nested group may
 *  repeat a label under a different parent, so ancestors are part of the key. */
export const navGroupKey = (
  ancestorLabels: readonly string[],
  label: string,
): string => [...ancestorLabels, label].join(" / ");

/** DOM id of the panel a group's toggle button controls (`aria-controls`). */
export const navGroupPanelId = (key: string): string =>
  `nav-group-${key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

/**
 * Manual toggles, stamped with the route they were made on.
 *
 * The stamp is the whole point. A collapse is an opinion about the page you are
 * looking at, not a standing preference, so it is discarded the moment the route
 * changes. That is what guarantees "you never land on a page whose nav entry is
 * hidden" — including via the back button, which does not remount the shell and
 * would otherwise carry a stale collapse into the page it lands on.
 */
export type NavToggles = {
  readonly pathname: string;
  readonly open: Readonly<Record<string, boolean>>;
};

export const NO_NAV_TOGGLES: NavToggles = { pathname: "", open: {} };

/** The toggles that still apply on `pathname`; a route change discards them. */
export const currentNavToggles = (
  toggles: NavToggles,
  pathname: string,
): Readonly<Record<string, boolean>> =>
  toggles.pathname === pathname ? toggles.open : {};

/** Record one group's new open state against the current route. */
export const toggleNavGroup = (
  toggles: NavToggles,
  pathname: string,
  key: string,
  open: boolean,
): NavToggles => ({
  pathname,
  open: { ...currentNavToggles(toggles, pathname), [key]: open },
});

/**
 * Is `group` open? The route decides by default — a group holding the active
 * link starts open, at every depth, so the entry for the page you are on is
 * always visible — and an explicit toggle made on this route wins.
 */
export const isNavGroupOpen = (
  group: NavItem,
  key: string,
  activeHref: string | null,
  toggles: Readonly<Record<string, boolean>>,
): boolean =>
  toggles[key] ?? (activeHref !== null && leafHrefs(group).includes(activeHref));

/**
 * The Engineer → Security screens, in nav order. Exported so the Engineer
 * console page groups its cards off this same list rather than keeping a second,
 * drifting idea of what "Security" means.
 */
export const ENGINEER_SECURITY_HREFS: readonly string[] = (() => {
  const engineer = NAV.find((i) => i.label === "Engineer");
  const security = engineer?.children?.find((c) => c.label === "Security");
  return security ? leafHrefs(security) : [];
})();

/**
 * Role- and capability-filtered nav. A group keeps only the children the user
 * may see and is dropped entirely if none remain — recursively, so an emptied
 * nested group takes itself out of its parent. `canVocab` drives the Vocabulary
 * item independently of the role string; `capabilities` is the effective
 * capability list from `GET /auth/context` and drives every item carrying a
 * `capability` code (fa-web-api #379).
 *
 * `capabilities` defaults to empty, which HIDES capability-gated items. That is
 * the safe default and matches engineer preview-as-role, where we hold the
 * engineer's own capabilities and cannot know the previewed role's.
 */
export function getVisibleNav(
  role: string,
  canVocab: boolean,
  capabilities: readonly string[] = [],
): NavItem[] {
  const isSuperAdmin = role === ROLE.ENGINEER || role === ROLE.SUPER_ADMIN;
  const isEngineer = role === ROLE.ENGINEER;
  const isViewOnly = role === ROLE.VIEW_ONLY;

  const canSee = (n: NavItem) =>
    (!n.superAdminOnly || isSuperAdmin) &&
    (!n.capability || hasCapability(capabilities, n.capability)) &&
    (!n.engineerOnly || isEngineer) &&
    (!n.vocabOnly || canVocab) &&
    (!n.hideViewOnly || !isViewOnly);

  const visible = (item: NavItem): NavItem[] => {
    if (!canSee(item)) return [];
    if (!item.children) return [item];
    const children = item.children.flatMap(visible);
    return children.length ? [{ ...item, children }] : [];
  };

  return NAV.flatMap(visible);
}
