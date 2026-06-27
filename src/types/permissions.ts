/**
 * Permission-config types, derived from the backend OpenAPI schema (#164/#163).
 * The engineer edits the matrix at `/engineer/permissions`; the Users section
 * renders a read-only view of it (`GET /admin/role-capabilities`).
 */
import type { Schema } from "./api";

/** One capability row: stable code + UI label/description; `assignable` is false
 *  for the engineer meta-capability (locked to the engineer). */
export type CapabilityInfo = Schema<"CapabilityInfo">;

/** A role and the capability codes it currently holds. `editable` is false for
 *  the engineer (always holds everything). `label` is the display name. */
export type RoleGrants = Schema<"RoleGrants">;

/** The full permission matrix: every capability + each role's grants. */
export type PermissionMatrix = Schema<"PermissionMatrix">;
