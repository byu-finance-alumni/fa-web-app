"use client";

import { useActionState, useState } from "react";
import {
  updatePersonalSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { PreferredContactPicker } from "@/components/alumni/PreferredContactPicker";
import { StateCombobox } from "@/components/alumni/StateCombobox";
import { Field, SelectField } from "@/components/alumni/form-fields";
import { COUNTRY_OPTIONS } from "@/constants/dropdowns";
import { withValue } from "@/hooks/useVocabOptions";
import { validateName } from "@/lib/nameValidation";

export type PersonalDefaults = {
  /** Legal first name. */
  first_name: string;
  middle_name: string;
  /** Legal last name — the one a marriage rename changes. */
  last_name: string;
  /** What the app DISPLAYS almost everywhere (list, profile, exports, survey)
   *  when set; the profile falls back to `first_name` when it is blank. */
  preferred_first_name: string;
  /** Maiden / former surname. Kept because every free-text search token also
   *  matches this column, so a renamed alumna is still findable under the name
   *  colleagues remember. */
  birth_name: string;
  personal_email: string;
  /** Also editable in the Employment section — surfaced here because the
   *  preferred-contact picker selects between it and the other two. */
  work_email: string;
  phone: string;
  /** Stored `contact.preferred_contact_method` ("" for none). */
  preferred_contact_method: string;
  /** Residence city — `contact.city`. The alum's HOME city, which is what the
   *  survey writes into this column and what the profile labels it. The
   *  EMPLOYER's city is `career.current_city`, edited in the Employment
   *  section. */
  city: string;
  /** Residence state — `contact.state`. Full names ("Utah", never "UT"). */
  state: string;
  /** Residence country — `contact.country`. */
  country: string;
  net_id: string;
  /** Combined "First Last" — split on the LAST space on save. */
  spouse_name: string;
  /** Top-level alumni field (NOT under `contact.`). */
  citizenship: string;
  /** Country of ORIGIN — a distinct field from `citizenship`, and unrelated to
   *  any address. Also top-level (NOT under `contact.`). */
  home_country: string;
};

export function PersonalSectionForm({
  id,
  defaults,
}: {
  id: number;
  defaults: PersonalDefaults;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updatePersonalSection.bind(null, id),
    null,
  );
  // Inline name validation (#626). The other sections have no client rules and
  // rely purely on the backend's 422 field errors; names need a pre-submit gate
  // because "Add alumni" requires first + last, and Edit must not be laxer.
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const errors = { ...(state?.fieldErrors ?? {}), ...clientErrors };

  // first/last are required ONLY when the record already has them. Requiring
  // them unconditionally would strand legacy records imported with a byu_id and
  // no name — their owner could never save an unrelated field in this section
  // again. What we DO block is erasing a name that exists, which is the case
  // that would break list display and name sorting.
  const firstRequired = defaults.first_name !== "";
  const lastRequired = defaults.last_name !== "";
  const validateNames = (formData: FormData): Record<string, string> => {
    const get = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" ? v : "";
    };
    const found: Record<string, string> = {};
    const checks: [string, boolean][] = [
      ["first_name", firstRequired],
      ["middle_name", false],
      ["last_name", lastRequired],
      ["preferred_first_name", false],
      ["birth_name", false],
    ];
    for (const [name, required] of checks) {
      const msg = validateName(get(name), { required });
      if (msg) found[name] = msg;
    }
    return found;
  };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const found = validateNames(new FormData(e.currentTarget));
    setClientErrors(found);
    if (Object.keys(found).length === 0) return;
    // preventDefault stops React from invoking the server action.
    e.preventDefault();
    const first = Object.keys(found)[0];
    const el = e.currentTarget.elements.namedItem(first);
    if (el instanceof HTMLElement) el.focus();
  };
  // Clear a field's inline error as soon as it becomes valid on blur.
  const handleNameBlur = (name: string, value: string, required: boolean) => {
    const msg = validateName(value, { required });
    setClientErrors((prev) => {
      if (prev[name] === msg || (!prev[name] && !msg)) return prev;
      const next = { ...prev };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  };
  // The three fields the preferred-contact picker selects between are tracked
  // live (the inputs stay uncontrolled — this only mirrors them) so a method
  // whose field is empty is blocked, and typing an address enables it without a
  // save/reload round-trip.
  const [personalEmail, setPersonalEmail] = useState(defaults.personal_email);
  const [workEmail, setWorkEmail] = useState(defaults.work_email);
  const [phone, setPhone] = useState(defaults.phone);

  return (
    <FocusedEditForm
      title="Update Personal Information"
      formAction={formAction}
      pending={pending}
      error={state?.error}
      cancelHref={`/alumni/${id}`}
      pickerHref={`/alumni/${id}/edit`}
      onSubmit={handleSubmit}
    >
      {/* Name block (#626). Names were previously settable only at creation or
          by CSV import, which left staff with no way to record a marriage
          rename. Kept at the top of the section because it identifies the
          record the rest of the fields describe. Ordered to match the "Add
          alumni" Core step: first + last paired, preferred beneath them. */}
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="First name"
          name="first_name"
          required={firstRequired}
          defaultValue={defaults.first_name}
          error={errors.first_name}
          onBlur={(n, v) => handleNameBlur(n, v, firstRequired)}
        />
        <Field
          label="Last name"
          name="last_name"
          required={lastRequired}
          defaultValue={defaults.last_name}
          error={errors.last_name}
          onBlur={(n, v) => handleNameBlur(n, v, lastRequired)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Preferred first name"
          name="preferred_first_name"
          defaultValue={defaults.preferred_first_name}
          error={errors.preferred_first_name}
          onBlur={(n, v) => handleNameBlur(n, v, false)}
          hint="Shown in place of the first name across the site. Leave blank to use the first name."
        />
        <Field
          label="Middle name"
          name="middle_name"
          defaultValue={defaults.middle_name}
          error={errors.middle_name}
          onBlur={(n, v) => handleNameBlur(n, v, false)}
        />
      </div>
      <Field
        label="Birth name"
        name="birth_name"
        defaultValue={defaults.birth_name}
        error={errors.birth_name}
        onBlur={(n, v) => handleNameBlur(n, v, false)}
        hint="Maiden or former last name. Record it when a last name changes — searches match it too, so the alumna stays findable under her previous name."
      />
      <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
        <Field
          label="Personal email"
          name="contact.personal_email"
          type="email"
          defaultValue={defaults.personal_email}
          onChange={(_n, v) => setPersonalEmail(v)}
          error={errors["contact.personal_email"]}
        />
        <Field
          label="Work email"
          name="contact.work_email"
          type="email"
          defaultValue={defaults.work_email}
          onChange={(_n, v) => setWorkEmail(v)}
          error={errors["contact.work_email"]}
        />
      </div>
      <Field
        label="Cell phone number"
        name="contact.phone"
        defaultValue={defaults.phone}
        onChange={(_n, v) => setPhone(v)}
        error={errors["contact.phone"]}
      />
      {/* Full-width, directly under the three fields it reads live values from
          (personal email, work email, phone above) — mirrors how AlumniForm
          renders this same picker: as its own block after the fields it
          selects between, never squeezed into a shared grid cell with one of
          them. Keeps the "choose which of these is preferred" relationship
          legible instead of reading as a stray radio column. */}
      <PreferredContactPicker
        name="contact.preferred_contact_method"
        values={{
          personal_email: personalEmail,
          work_email: workEmail,
          phone,
        }}
        defaultValue={defaults.preferred_contact_method}
        error={errors["contact.preferred_contact_method"]}
      />
      {/* Residence (#440). Restored after #287's stage 1 stripped it: at that
          point `contact.city/state/country` only ever held the EMPLOYER address
          the import wrote, so editing them under a home label was wrong. That is
          no longer true — the survey asks alumni for their residence and writes
          these exact three columns, the intake sheet has "Residence city" /
          "Residence state" columns, and the profile renders `contact.city` as
          "Residence city". Staff were the only ones left without a way to enter
          it, which is the gap Amy hit.

          Same controls the survey uses for the same three columns, so the two
          entry points agree on what a state and a country are called:
          `StateCombobox` over the 50 states + DC by full name (pick-or-type, so
          an international province still saves verbatim), and the shared
          `COUNTRY_OPTIONS` list with the stored value preserved by `withValue`.

          Labelled and headed "Residence" so nobody reads these as the office —
          the employer's city/state live on `career.current_*` in the Employment
          section. */}
      <h3 className="border-t border-gray-100 pt-4 text-xs font-semibold uppercase tracking-wide text-navy-800">
        Residence
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Residence city"
          name="contact.city"
          defaultValue={defaults.city}
          error={errors["contact.city"]}
        />
        <StateCombobox
          label="Residence state"
          name="contact.state"
          defaultValue={defaults.state}
          error={errors["contact.state"]}
        />
      </div>
      <SelectField
        label="Residence country"
        name="contact.country"
        // A country already on file that isn't in the list stays selectable, so
        // saving an unrelated field in this section can't quietly rewrite it.
        options={withValue(COUNTRY_OPTIONS, defaults.country)}
        defaultValue={defaults.country}
        error={errors["contact.country"]}
      />
      {/* border-t divider marks the end of the residence block above
          and the start of the remaining personal fields below (same
          within-card separator idiom as DashboardSearch's action bar and the
          profile page's section dividers). */}
      <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
        <Field
          label="NetID"
          name="net_id"
          defaultValue={defaults.net_id}
          error={errors.net_id}
        />
        <Field
          label="Spouse name"
          name="spouse_name"
          defaultValue={defaults.spouse_name}
          error={errors.spouse_first_name}
        />
        {/* Citizenship — a top-level alumni field, hence no `contact.` prefix,
            and unrelated to any address. It briefly stood in for the removed
            "Resident City/State/Country" trio while #287 stage 1 had those
            columns bound to the employer; the Residence block above owns that
            job again (#440), and the two now sit side by side because they
            answer different questions. */}
        <Field
          label="Citizenship"
          name="citizenship"
          defaultValue={defaults.citizenship}
          error={errors.citizenship}
        />
        {/* Country of ORIGIN, not an address and not the same as citizenship —
            both are separate columns on the intake sheet ("Citizenship" and
            "Home country") and both render on the profile. The profile has
            always shown this; it was never editable here. */}
        <Field
          label="Home country"
          name="home_country"
          defaultValue={defaults.home_country}
          error={errors.home_country}
        />
      </div>
    </FocusedEditForm>
  );
}
