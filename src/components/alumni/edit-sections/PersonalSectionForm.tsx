"use client";

import { useActionState, useState } from "react";
import {
  updatePersonalSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { PreferredContactPicker } from "@/components/alumni/PreferredContactPicker";
import { Field } from "@/components/alumni/form-fields";

export type PersonalDefaults = {
  personal_email: string;
  /** Also editable in the Employment section — surfaced here because the
   *  preferred-contact picker selects between it and the other two. */
  work_email: string;
  phone: string;
  /** Stored `contact.preferred_contact_method` ("" for none). */
  preferred_contact_method: string;
  net_id: string;
  /** Combined "First Last" — split on the LAST space on save. */
  spouse_name: string;
  city: string;
  state: string;
  country: string;
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
  const errors = state?.fieldErrors ?? {};
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
    >
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Cell phone number"
          name="contact.phone"
          defaultValue={defaults.phone}
          onChange={(_n, v) => setPhone(v)}
          error={errors["contact.phone"]}
        />
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
      </div>
      <div className="grid grid-cols-2 gap-4">
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
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Resident City"
          name="contact.city"
          defaultValue={defaults.city}
          error={errors["contact.city"]}
        />
        <Field
          label="Resident State"
          name="contact.state"
          defaultValue={defaults.state}
          error={errors["contact.state"]}
        />
      </div>
      <Field
        label="Resident Country"
        name="contact.country"
        defaultValue={defaults.country}
        error={errors["contact.country"]}
      />
    </FocusedEditForm>
  );
}
