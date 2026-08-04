/**
 * Capability codes and the predicates that read them.
 *
 * Capabilities are the EDITABLE half of the permission model (fa-web-api #164):
 * the codes are fixed in backend code, but which roles hold them is data an
 * engineer edits in the Engineer Console → Permissions matrix. So a UI gate that
 * asks "is this user full_access?" is wrong for anything capability-backed — it
 * ignores the engineer's edits and will show the wrong controls the moment a
 * capability is granted to another role. Ask for the CAPABILITY instead; it
 * arrives on `GET /auth/context` as `capabilities` (already resolved by the
 * backend, engineer hard-override included).
 *
 * As always, these predicates are UX ONLY — the backend re-checks every request.
 * Their job is to avoid offering a control that would 403 on click.
 *
 * Codes MUST match `fa-web-api/app/core/capabilities.py`.
 */

export const CAPABILITY = {
  /** Create a single event by hand (POST /events). */
  EVENTS_CREATE: "events.create",
  /** Bulk-upload an event + attendee roster from a CSV (/events/import*). */
  EVENTS_IMPORT: "events.import",
} as const;

export type CapabilityCode = (typeof CAPABILITY)[keyof typeof CAPABILITY];

/** Does this user hold `code`? Missing/absent capabilities → false. */
export const hasCapability = (
  capabilities: readonly string[] | null | undefined,
  code: string,
): boolean => (capabilities ?? []).includes(code);

/**
 * May create a single event (fa-web-api #378). Seeded to full_access and up,
 * but an engineer can widen or narrow it — so never substitute a role check.
 */
export const canCreateEvents = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.EVENTS_CREATE);

/**
 * May bulk-upload events from a CSV (fa-web-api #378). Deliberately separate
 * from {@link canCreateEvents}: one file can create an event plus hundreds of
 * attendance rows, so the two are granted independently.
 */
export const canImportEvents = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.EVENTS_IMPORT);
