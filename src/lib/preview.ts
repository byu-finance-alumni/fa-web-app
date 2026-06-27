/**
 * Preview-as-role (#165) shared constants/helpers.
 *
 * When an engineer enters preview mode, a cookie records the role they're
 * previewing. The app shell (app layout) reads it and renders the navigation as
 * that role, with a persistent banner. This is a read-only, frontend-only
 * affordance — it never grants the engineer anything (the previewed roles are
 * strictly LESS privileged), and the backend continues to authorize the
 * engineer's real session on every request.
 */
import { ROLE, type RoleId } from "@/constants/roles";

/** Cookie holding the role the engineer is currently previewing as. */
export const PREVIEW_COOKIE = "fa_preview_role";

/** Roles an engineer may preview as — every role below engineer. */
export const PREVIEWABLE_ROLES: readonly RoleId[] = [
  ROLE.SUPER_ADMIN,
  ROLE.FULL_ACCESS,
  ROLE.STUDENT,
  ROLE.VIEW_ONLY,
];

/** Narrow an arbitrary cookie value to a valid previewable role, else null. */
export function asPreviewRole(value: string | undefined | null): RoleId | null {
  return value && (PREVIEWABLE_ROLES as readonly string[]).includes(value)
    ? (value as RoleId)
    : null;
}
