"use client";

import {
  Field,
  SelectField,
  TextareaField,
} from "@/components/shared/form-fields";

/** Pre-fill values. Dates must be `YYYY-MM-DD` for `<input type="date">`. */
export interface EventFieldValues {
  event_name?: string | null;
  event_type?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  event_notes?: string | null;
}

/**
 * The event's data fields — one definition, used by BOTH the Add-event wizard
 * and the edit form (#611).
 *
 * Built from the same `Field` / `SelectField` / `TextareaField` primitives as
 * the alumni forms, so an event reads with the identical label style, required
 * asterisk, inline error, and two-up grid. Sharing the block (rather than
 * copying it) is what keeps add and edit from drifting apart the way they had.
 *
 * Layout follows the alumni Core section: full-width name, a two-up row that
 * stacks on a phone, then the wide fields. Text only — no icons.
 */
export function EventFields({
  values,
  errors = {},
  eventTypeOptions = [],
  onBlur,
}: {
  values?: EventFieldValues;
  /** Field name → message. Client-side and server 422 errors, already merged. */
  errors?: Record<string, string>;
  /** Managed event-type options (Admin → Vocabulary). */
  eventTypeOptions?: string[];
  /** Fires on blur so the wizard can validate a field as it is left. */
  onBlur?: (name: string, value: string) => void;
}) {
  // Preserve a legacy/unlisted type on the record so editing never silently
  // drops it: offer it as an extra option even if it left the vocabulary.
  const current = values?.event_type ?? "";
  const hasCurrent = eventTypeOptions.some(
    (o) => o.toLowerCase() === current.toLowerCase(),
  );
  const typeOptions =
    current && !hasCurrent ? [current, ...eventTypeOptions] : eventTypeOptions;

  return (
    <div className="space-y-4">
      <Field
        label="Event name"
        name="event_name"
        required
        defaultValue={values?.event_name ?? ""}
        error={errors.event_name}
        onBlur={onBlur}
        placeholder="Spring Finance Mixer"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Type"
          name="event_type"
          options={typeOptions}
          defaultValue={current}
          error={errors.event_type}
        />
        <Field
          label="Date"
          name="event_date"
          type="date"
          required
          defaultValue={values?.event_date ?? ""}
          error={errors.event_date}
          onBlur={onBlur}
        />
      </div>
      <Field
        label="Location"
        name="event_location"
        defaultValue={values?.event_location ?? ""}
        error={errors.event_location}
        onBlur={onBlur}
        placeholder="Tanner Building, Provo"
      />
      <TextareaField
        label="Notes"
        name="event_notes"
        rows={3}
        defaultValue={values?.event_notes ?? ""}
        error={errors.event_notes}
      />
    </div>
  );
}
