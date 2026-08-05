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
  /** Read alumni records, the dashboard, the map, events. */
  VIEW: "view",
  /** Edit an EXISTING alumnus and their nested records. */
  ALUMNI_EDIT: "alumni.edit",
  /** Log / amend an interaction on an alumnus's timeline. Held by every role. */
  INTERACTIONS_CREATE: "interactions.create",
  /** Create new alumni + friend records. */
  ALUMNI_CREATE: "alumni.create",
  /** Archive and restore alumni. */
  ALUMNI_ARCHIVE: "alumni.archive",
  /** The new-record and bulk-update CSV importers. */
  ALUMNI_IMPORT: "alumni.import",
  /** Any download of alumni data — list, profile, cohort, event roster. */
  ALUMNI_EXPORT: "alumni.export",
  /** Headshot upload / replace / remove, including the bulk photo import. */
  ALUMNI_PHOTOS: "alumni.photos",
  /** Create a single event by hand (POST /events). */
  EVENTS_CREATE: "events.create",
  /** Bulk-upload an event + attendee roster from a CSV (/events/import*). */
  EVENTS_IMPORT: "events.import",
  /** Edit/delete an event and manage its attendee roster. */
  EVENTS_MANAGE: "events.manage",
  /** Write, edit, and delete notes. Reading them only needs `view`. */
  NOTES_MANAGE: "notes.manage",
  /** The survey console: responses review + campaign scheduling/sending. */
  SURVEYS_MANAGE: "surveys.manage",
  /** See Pay It Forward donor records and dollar amounts. */
  DONATIONS_VIEW: "donations.view",
  /** Write to the Pay It Forward donation ledger. */
  DONATIONS_MANAGE: "donations.manage",
  /** Activity feed, data quality, queues, task list, map drill-downs. */
  REPORTS_ADVANCED: "reports.advanced",
  /** The controlled-vocabulary editor. */
  VOCAB_ADMIN: "vocab_admin",
  /** The per-alumnus profile-completeness tab. */
  PROFILE_COMPLETENESS: "profile.completeness",
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

/**
 * The #379 split: `alumni.full` ("Manage alumni & data") used to be one switch
 * over creating, archiving, importing, exporting, headshots, event management,
 * notes, surveys, donation reads, and the advanced reports. Each of those is now
 * its own capability, so the UI must ask for the specific one — a `hasFullAccess`
 * role check here would ignore the engineer's edits and show the wrong controls.
 */

/** May log an interaction. Seeded to EVERY role — a professor can record one. */
export const canAddInteraction = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.INTERACTIONS_CREATE);

/** May create new alumni / friend records. */
export const canCreateAlumni = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.ALUMNI_CREATE);

/** May archive or restore an alumnus. */
export const canArchiveAlumni = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.ALUMNI_ARCHIVE);

/** May run either CSV importer (new records or bulk update). */
export const canImportAlumni = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.ALUMNI_IMPORT);

/**
 * May download alumni data — the list export, a single profile, an event's
 * attendee roster, or the cohort file used to prepare a bulk update. One
 * capability across every export screen, because the thing being gated is
 * personal data leaving the system, not which page the button sits on.
 */
export const canExportAlumni = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.ALUMNI_EXPORT);

/** May upload / replace / remove headshots, including the bulk import. */
export const canManageHeadshots = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.ALUMNI_PHOTOS);

/** May edit/delete an event and manage its attendee roster. */
export const canManageEvents = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.EVENTS_MANAGE);

/** May write, edit, or delete notes. Reading them needs only `view`. */
export const canWriteNotes = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.NOTES_MANAGE);

/** May use the survey console. */
export const canManageSurveys = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.SURVEYS_MANAGE);

/** May see Pay It Forward donor records and dollar amounts. */
export const canViewDonations = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.DONATIONS_VIEW);

/** May reach the advanced read-only reporting surfaces. */
export const canViewAdvancedReports = (
  capabilities: readonly string[] | null | undefined,
) => hasCapability(capabilities, CAPABILITY.REPORTS_ADVANCED);
