"use client";

import { useActionState } from "react";
import {
  updatePersonalSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { Field } from "@/components/alumni/form-fields";

export type PersonalDefaults = {
  personal_email: string;
  phone: string;
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
          error={errors["contact.personal_email"]}
        />
        <Field
          label="Cell phone number"
          name="contact.phone"
          defaultValue={defaults.phone}
          error={errors["contact.phone"]}
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
