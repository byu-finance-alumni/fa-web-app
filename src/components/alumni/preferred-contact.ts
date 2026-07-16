/**
 * Shared logic for the "preferred contact method" picker (#449).
 *
 * `contact.preferred_contact_method` decides which single contact link the
 * profile header renders (`/alumni/[id]/page.tsx`); when unset the header falls
 * back to personal email, then phone. Tanya's ask was a way to flip an alumnus
 * to their work email when they've said that's how they want to be reached.
 *
 * Kept in a plain `.ts` module (no JSX) so BOTH the full `AlumniForm` and the
 * focused `PersonalSectionForm` derive their options from one place — they
 * can't drift — and so the derivation is unit-testable in the node-env vitest
 * suite.
 */

/** The field whose value each offered method points at. */
export type PreferredContactField = "personal_email" | "work_email" | "phone";

/** The current text of each field the picker can select, as typed in the form. */
export type PreferredContactValues = Partial<
  Record<PreferredContactField, string>
>;

/** The picker's "no preference" selection — submits blank, stores `null`, and
 *  lets the profile header fall back to personal email. */
export const PREFERRED_CONTACT_NONE = "";

/**
 * Methods OFFERED by the picker. Values match the backend
 * `contact.preferred_contact_method` enum.
 *
 * `linkedin` is a valid STORED value but is deliberately absent: the ask scoped
 * this to emails + phone. It is preserved rather than clobbered when already
 * stored — see {@link preferredContactOptions}.
 */
export const PREFERRED_CONTACT_METHODS: readonly {
  value: string;
  label: string;
  field: PreferredContactField;
}[] = [
  { value: "personal_email", label: "Personal email", field: "personal_email" },
  { value: "work_email", label: "Work email", field: "work_email" },
  { value: "phone", label: "Phone", field: "phone" },
];

/** Display labels for stored values the picker doesn't offer, so a preserved
 *  option reads as a name rather than a raw enum token. */
const PRESERVED_LABELS: Record<string, string> = { linkedin: "LinkedIn" };

export type PreferredContactOption = {
  value: string;
  label: string;
  /** True when the method's field is blank. Selecting it would leave the header
   *  silently falling back, so the radio is rendered disabled ("blocked"). */
  disabled: boolean;
  /** True for an out-of-list stored value carried through for preservation
   *  (today only `linkedin`) rather than one this control offers. */
  preserved: boolean;
};

/**
 * The radio options to render, given what's currently typed into the fields and
 * the value already stored on the record.
 *
 * A method whose field is empty comes back `disabled` — the picker blocks it
 * instead of letting someone save a preference the header can't honor.
 *
 * An out-of-list `current` (i.e. `linkedin`) is appended as a selected option,
 * mirroring `withValue()` for out-of-list regions in `AlumniForm`: the value
 * stays submittable, so saving this section preserves it instead of silently
 * downgrading the alumnus to "no preference".
 */
export function preferredContactOptions(
  values: PreferredContactValues,
  current: string = PREFERRED_CONTACT_NONE,
): PreferredContactOption[] {
  const options: PreferredContactOption[] = PREFERRED_CONTACT_METHODS.map(
    (m) => ({
      value: m.value,
      label: m.label,
      disabled: (values[m.field] ?? "").trim() === "",
      preserved: false,
    }),
  );
  if (
    current !== PREFERRED_CONTACT_NONE &&
    !options.some((o) => o.value === current)
  ) {
    options.push({
      value: current,
      label: PRESERVED_LABELS[current] ?? current,
      disabled: false,
      preserved: true,
    });
  }
  return options;
}

/**
 * The selection to actually render as checked. Anything that isn't an enabled
 * option collapses to "no preference" — so emptying the field a preference
 * points at (e.g. clearing the work email) drops the now-unhonorable selection
 * on the spot instead of saving a broken-looking one.
 */
export function resolvePreferredContact(
  options: readonly PreferredContactOption[],
  selected: string,
): string {
  const match = options.find((o) => o.value === selected);
  return match && !match.disabled ? selected : PREFERRED_CONTACT_NONE;
}
