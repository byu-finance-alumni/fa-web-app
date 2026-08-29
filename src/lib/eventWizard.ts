/**
 * Pure logic behind the "Add event" wizard (#611).
 *
 * Kept out of the component for the same reason the alumni form keeps its
 * validators at module scope: the rules are the interesting part and they are
 * testable without a DOM. Everything here mirrors the backend — the API
 * re-validates and re-checks on POST /events; this only exists so the user gets
 * inline feedback without a round trip.
 */

/* ------------------------------------------------------------- steps ------ */

/** Wizard step labels, in order. The last one is Review (see REVIEW_STEP). */
export const EVENT_STEPS = ["Event details", "Attendees", "Review"] as const;

export type EventStep = (typeof EVENT_STEPS)[number];

/** Index of the final Review step. */
export const EVENT_REVIEW_STEP = EVENT_STEPS.length - 1;

/** Index of the last data-entry step before Review. */
export const EVENT_LAST_DATA_STEP = EVENT_REVIEW_STEP - 1;

/* ---------------------------------------------------- attendee plan ------- */

/**
 * What happens to the attendee list AFTER the event is saved.
 *
 * The whole point of #611 is that neither choice is a precondition: an event is
 * created on its own either way, and this only decides where the user lands
 * next. "later" is the default and the common case.
 */
export const ATTENDEE_PLAN = {
  /** Land on the event, where attendees can be added whenever. */
  LATER: "later",
  /** Go straight to the attendee-list upload for the new event. */
  UPLOAD: "upload",
} as const;

export type AttendeePlan = (typeof ATTENDEE_PLAN)[keyof typeof ATTENDEE_PLAN];

/** Form field carrying the plan through the create action. */
export const ATTENDEE_PLAN_FIELD = "attendee_plan";

/**
 * Where the create action sends the user once the event exists.
 *
 * Both destinations can add attendees; "upload" just skips a click for someone
 * who already has the list in hand. Anything unrecognised falls back to the
 * event itself, so a stray value can never strand a freshly-created event.
 */
export function postCreateHref(eventId: number, plan: string | null): string {
  return plan === ATTENDEE_PLAN.UPLOAD
    ? `/events/${eventId}/attendees/import`
    : `/events/${eventId}/edit?created=1`;
}

/* -------------------------------------------------------- validation ------ */

/** Column widths from `events` in database/schema.sql. */
export const EVENT_MAX_LEN = {
  event_name: 255,
  event_type: 100,
  event_location: 255,
  event_notes: 10000,
} as const;

/** `<input type="date">` always submits YYYY-MM-DD; reject anything else. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fields the wizard validates client-side, in the order they are focused. */
export const EVENT_VALIDATED_FIELDS = [
  "event_name",
  "event_date",
  "event_type",
  "event_location",
  "event_notes",
] as const;

/** Validate a single field's raw string value. Returns a message or null. */
export function validateEventField(name: string, raw: string): string | null {
  const v = raw.trim();

  switch (name) {
    case "event_name":
      if (v === "") return "Required.";
      if (v.length > EVENT_MAX_LEN.event_name)
        return `Must be ${EVENT_MAX_LEN.event_name} characters or fewer.`;
      return null;

    case "event_date":
      if (v === "") return "Required.";
      if (!ISO_DATE_RE.test(v)) return "Enter a valid date.";
      if (Number.isNaN(Date.parse(`${v}T00:00:00Z`)))
        return "Enter a valid date.";
      return null;

    case "event_type":
      if (v === "") return null;
      if (v.length > EVENT_MAX_LEN.event_type)
        return `Must be ${EVENT_MAX_LEN.event_type} characters or fewer.`;
      return null;

    case "event_location":
      if (v === "") return null;
      if (v.length > EVENT_MAX_LEN.event_location)
        return `Must be ${EVENT_MAX_LEN.event_location} characters or fewer.`;
      return null;

    case "event_notes":
      if (v.length > EVENT_MAX_LEN.event_notes)
        return `Must be ${EVENT_MAX_LEN.event_notes} characters or fewer.`;
      return null;

    default:
      return null;
  }
}

/** Read a FormData entry as a plain string ("" when absent/not a string). */
function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/** Validate every event field in a submitted FormData → name→message map. */
export function validateEventDetails(
  formData: FormData,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const name of EVENT_VALIDATED_FIELDS) {
    const msg = validateEventField(name, str(formData, name));
    if (msg) errors[name] = msg;
  }
  return errors;
}

/* ----------------------------------------------------------- preview ------ */

/** The event as it will be saved — trimmed, blanks dropped to null. */
export interface EventValues {
  event_name: string;
  event_type: string | null;
  event_date: string;
  event_location: string | null;
  event_notes: string | null;
}

/** Pull the saveable values out of a submitted FormData. */
export function readEventValues(formData: FormData): EventValues {
  const trimmed = (k: string) => {
    const v = str(formData, k).trim();
    return v === "" ? null : v;
  };
  return {
    event_name: str(formData, "event_name").trim(),
    event_type: trimmed("event_type"),
    event_date: str(formData, "event_date").trim(),
    event_location: trimmed("event_location"),
    event_notes: trimmed("event_notes"),
  };
}

/** An advisory finding on the Review step. Never blocks saving. */
export interface EventWarning {
  code: "duplicate" | "past_date" | "no_type" | "no_location";
  message: string;
  /** Set on `duplicate` so the review can link to the event already on file. */
  event_id?: number;
}

/** The minimum shape {@link buildEventWarnings} needs from an existing event. */
export interface ExistingEvent {
  event_id: number;
  event_name: string;
  event_date?: string | null;
}

/** Normalize a name for duplicate comparison: trimmed, collapsed, casefolded. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Advisory findings for the Review step.
 *
 * Deliberately warnings only — nothing here blocks creating the event. A staff
 * member is allowed to log a past event, skip the type, or leave the location
 * open; the review just makes sure none of it is an accident. The duplicate
 * check matters most: the CSV importer flat-out REJECTS a repeated name+date,
 * so a hand-created twin is a real hazard.
 *
 * `today` is passed in (never read from the clock) so this stays pure and the
 * past-date rule is testable.
 */
export function buildEventWarnings(
  values: EventValues,
  existing: readonly ExistingEvent[],
  today: string,
): EventWarning[] {
  const warnings: EventWarning[] = [];

  const name = normalizeName(values.event_name);
  const dup = existing.find(
    (e) =>
      normalizeName(e.event_name ?? "") === name &&
      (e.event_date ?? "") === values.event_date,
  );
  if (dup) {
    warnings.push({
      code: "duplicate",
      message:
        "An event with this name and date is already on file. Creating this one will make a second copy.",
      event_id: dup.event_id,
    });
  }

  if (values.event_date && values.event_date < today) {
    warnings.push({
      code: "past_date",
      message:
        "This date is in the past. That is fine for an event you are recording after the fact. Check it is the date you meant.",
    });
  }

  if (!values.event_type) {
    warnings.push({
      code: "no_type",
      message:
        "No event type. The events list filters and groups by type, so this event will be harder to find later.",
    });
  }

  if (!values.event_location) {
    warnings.push({
      code: "no_location",
      message: "No location. Search matches on location as well as name.",
    });
  }

  return warnings;
}

/** One row of the Review step's summary. */
export interface EventSummaryRow {
  label: string;
  value: string;
  /** True when the field is empty — rendered muted rather than as a value. */
  empty: boolean;
}

/** The values, in field order, ready to render as the Review summary. */
export function buildEventSummary(values: EventValues): EventSummaryRow[] {
  const row = (label: string, value: string | null): EventSummaryRow => ({
    label,
    value: value && value.trim() !== "" ? value : "Not set",
    empty: !value || value.trim() === "",
  });
  return [
    row("Event name", values.event_name),
    row("Type", values.event_type),
    row("Date", values.event_date),
    row("Location", values.event_location),
    row("Notes", values.event_notes),
  ];
}
