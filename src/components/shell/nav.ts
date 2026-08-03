import { ROLE } from "@/constants/roles";

/**
 * Shared navigation model for the app shell — consumed by both the desktop
 * `Sidebar` and the mobile "More" menu so the two never drift. Gating legend
 * (see `getVisibleNav`):
 *   (no flag)      → every role
 *   hideViewOnly   → student and up (hidden from view_only / "Professor")
 *   fullAccessOnly → full_access, super_admin, engineer
 *   superAdminOnly → super_admin, engineer
 *   vocabOnly      → holders of the vocab_admin capability (engineer + granted)
 *   engineerOnly   → engineer only
 */
export type NavLeaf = {
  href: string;
  label: string;
  superAdminOnly?: boolean;
  fullAccessOnly?: boolean;
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
  { href: "/activity", label: "Activity", fullAccessOnly: true },

  {
    href: "/manage",
    label: "Manage",
    fullAccessOnly: true,
    children: [
      { href: "/tasks", label: "Tasks", fullAccessOnly: true },
      {
        href: "/needs-surveying",
        label: "Needs Surveying",
        fullAccessOnly: true,
      },
      { href: "/pay-it-forward", label: "Pay It Forward", fullAccessOnly: true },
      { href: "/data-quality", label: "Data quality", fullAccessOnly: true },
      { href: "/admin/import", label: "Import", fullAccessOnly: true },
      { href: "/admin/import/update", label: "Update", fullAccessOnly: true },
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
 * Role-filtered nav. A group keeps only the children the user may see and is
 * dropped entirely if none remain. `canVocab` drives the capability-gated
 * Vocabulary item independently of the role string.
 */
export function getVisibleNav(role: string, canVocab: boolean): NavItem[] {
  const isSuperAdmin = role === ROLE.ENGINEER || role === ROLE.SUPER_ADMIN;
  const isEngineer = role === ROLE.ENGINEER;
  const hasFullAccess =
    role === ROLE.ENGINEER ||
    role === ROLE.SUPER_ADMIN ||
    role === ROLE.FULL_ACCESS;
  const isViewOnly = role === ROLE.VIEW_ONLY;

  const canSee = (n: NavLeaf) =>
    (!n.superAdminOnly || isSuperAdmin) &&
    (!n.fullAccessOnly || hasFullAccess) &&
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
