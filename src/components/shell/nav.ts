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
export type NavLeaf = {
  href: string;
  label: string;
  /** Capability code required to see this item (fa-web-api #379). */
  capability?: string;
  superAdminOnly?: boolean;
  engineerOnly?: boolean;
  vocabOnly?: boolean;
  hideViewOnly?: boolean;
};

export type NavItem = NavLeaf & {
  children?: NavLeaf[];
};

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/alumni", label: "Alumni" },
  { href: "/friends", label: "Friends" },
  { href: "/events", label: "Events" },
  { href: "/map", label: "Map" },
  { href: "/statistics", label: "Statistics" },
  {
    href: "/activity",
    label: "Activity",
    capability: CAPABILITY.REPORTS_ADVANCED,
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
      { href: "/engineer/logins", label: "Logins", engineerOnly: true },
      {
        href: "/engineer/login-failures",
        label: "Login failures",
        engineerOnly: true,
      },
      {
        href: "/engineer/support-contacts",
        label: "Support contacts",
        engineerOnly: true,
      },
    ],
  },
];

/** Every navigable leaf href (group headers are toggles, not links), plus the
 *  standalone privacy link — for resolving the active nav item. */
export const LEAF_HREFS: string[] = [
  ...NAV.flatMap((i) => (i.children ? i.children.map((c) => c.href) : [i.href])),
  "/privacy",
];

/** The active link is the LONGEST leaf href the current path matches (exact, or
 *  as a "/parent/…" prefix) — so a deeper route wins over a shorter prefix. */
export const resolveActiveHref = (pathname: string): string | null =>
  LEAF_HREFS.reduce<string | null>((best, href) => {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) return best;
    return best === null || href.length > best.length ? href : best;
  }, null);

/**
 * Role- and capability-filtered nav. A group keeps only the children the user
 * may see and is dropped entirely if none remain. `canVocab` drives the
 * Vocabulary item independently of the role string; `capabilities` is the
 * effective capability list from `GET /auth/context` and drives every item
 * carrying a `capability` code (fa-web-api #379).
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

  const canSee = (n: NavLeaf) =>
    (!n.superAdminOnly || isSuperAdmin) &&
    (!n.capability || hasCapability(capabilities, n.capability)) &&
    (!n.engineerOnly || isEngineer) &&
    (!n.vocabOnly || canVocab) &&
    (!n.hideViewOnly || !isViewOnly);

  return NAV.flatMap((item) => {
    if (item.children) {
      const children = item.children.filter(canSee);
      return children.length ? [{ ...item, children }] : [];
    }
    return canSee(item) ? [item] : [];
  });
}
