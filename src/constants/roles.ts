/**
 * Canonical role identifiers, display labels, and permission predicates.
 *
 * Single source of truth for roles on the frontend — Sidebar, RoleManager,
 * CreateUserDialog, the app layout, and the alumni pages all read from here
 * instead of duplicating role literals.
 *
 * Machine ids MUST match the backend `RoleName` enum (fa-web-api
 * `app/core/roles.py`). The frontend NEVER enforces security — the backend
 * re-checks every request — these predicates only decide what UI to show.
 *
 * Hierarchy (most → least privileged):
 *   engineer ⊇ super_admin ⊇ full_access ⊇ student ⊇ view_only
 *
 * Note: `view_only` is surfaced in the UI as **"Professor"** — the machine id
 * stays `view_only`. `student` is a narrow writer that may edit EXISTING alumni
 * (mirrors the backend `require_alumni_edit` guard) but may not create new
 * alumni, archive/restore, import, or administer users.
 */

export const ROLE = {
  ENGINEER: "engineer",
  SUPER_ADMIN: "super_admin",
  FULL_ACCESS: "full_access",
  STUDENT: "student",
  VIEW_ONLY: "view_only",
} as const;

export type RoleId = (typeof ROLE)[keyof typeof ROLE];

/** Display labels keyed by machine id. `view_only` → "Professor". */
export const ROLE_LABEL: Record<string, string> = {
  [ROLE.ENGINEER]: "Engineer",
  [ROLE.SUPER_ADMIN]: "Super admin",
  [ROLE.FULL_ACCESS]: "Full access",
  [ROLE.STUDENT]: "Student",
  [ROLE.VIEW_ONLY]: "Professor",
};

/** Human label for a role machine id, falling back to the raw id if unknown. */
export const roleLabel = (id: string): string => ROLE_LABEL[id] ?? id;

/** Privilege ladder, most → least privileged. */
export const ROLE_ORDER: readonly RoleId[] = [
  ROLE.ENGINEER,
  ROLE.SUPER_ADMIN,
  ROLE.FULL_ACCESS,
  ROLE.STUDENT,
  ROLE.VIEW_ONLY,
];

/** Resolve a user's single highest role from their role array (for nav). */
export function highestRole(roles: readonly string[] | null | undefined): string {
  const held = new Set(roles ?? []);
  return ROLE_ORDER.find((r) => held.has(r)) ?? "";
}

// --- Permission predicates (mirror the backend guards) -----------------------

const EDIT_ALUMNI_ROLES = new Set<string>([
  ROLE.ENGINEER,
  ROLE.SUPER_ADMIN,
  ROLE.FULL_ACCESS,
  ROLE.STUDENT,
]);
const FULL_ACCESS_ROLES = new Set<string>([
  ROLE.ENGINEER,
  ROLE.SUPER_ADMIN,
  ROLE.FULL_ACCESS,
]);
const USER_ADMIN_ROLES = new Set<string>([ROLE.ENGINEER, ROLE.SUPER_ADMIN]);

const hasAny = (roles: readonly string[] | null | undefined, set: Set<string>) =>
  (roles ?? []).some((r) => set.has(r));

/**
 * May edit an EXISTING alumnus and their nested records (interactions,
 * employment, education, leadership, tags, status labels, tasks, event
 * attendance). Mirrors backend `require_alumni_edit`:
 * engineer / super_admin / full_access / student.
 */
export const canEditAlumni = (roles: readonly string[] | null | undefined) =>
  hasAny(roles, EDIT_ALUMNI_ROLES);

/**
 * May create new alumni, import CSV, manage events, and reach full-access
 * tooling (Tasks, Data quality). Mirrors backend `require_full_access`:
 * engineer / super_admin / full_access. Excludes `student`.
 */
export const hasFullAccess = (roles: readonly string[] | null | undefined) =>
  hasAny(roles, FULL_ACCESS_ROLES);

/**
 * User & audit administration (the Admin → Users / Audit screens). Mirrors
 * backend `require_super_admin`: engineer / super_admin.
 */
export const isUserAdmin = (roles: readonly string[] | null | undefined) =>
  hasAny(roles, USER_ADMIN_ROLES);

// --- Admin UI option lists ---------------------------------------------------

/**
 * Roles grantable to an EXISTING user via the role manager. `engineer` and
 * `super_admin` are included here (they can be granted to an existing account)
 * but are deliberately NOT in {@link CREATABLE_ROLES} below.
 */
export const ASSIGNABLE_ROLES: { value: RoleId; label: string }[] = [
  { value: ROLE.ENGINEER, label: ROLE_LABEL[ROLE.ENGINEER] },
  { value: ROLE.SUPER_ADMIN, label: ROLE_LABEL[ROLE.SUPER_ADMIN] },
  { value: ROLE.FULL_ACCESS, label: ROLE_LABEL[ROLE.FULL_ACCESS] },
  { value: ROLE.STUDENT, label: ROLE_LABEL[ROLE.STUDENT] },
  { value: ROLE.VIEW_ONLY, label: ROLE_LABEL[ROLE.VIEW_ONLY] },
];

/**
 * Roles offered at account-creation time. The top roles (engineer, super_admin)
 * are NOT bootstrappable here — the backend 422s them — so they can only be
 * granted to an existing account afterward via {@link ASSIGNABLE_ROLES}.
 */
export const CREATABLE_ROLES: { value: RoleId; label: string }[] = [
  { value: ROLE.FULL_ACCESS, label: ROLE_LABEL[ROLE.FULL_ACCESS] },
  { value: ROLE.STUDENT, label: ROLE_LABEL[ROLE.STUDENT] },
  { value: ROLE.VIEW_ONLY, label: ROLE_LABEL[ROLE.VIEW_ONLY] },
];

/** Role machine ids creatable at account-creation time (for typing). */
export type CreatableRoleId = (typeof CREATABLE_ROLES)[number]["value"];
