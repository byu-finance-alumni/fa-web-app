"use client";

import { useActionState } from "react";
import {
  updateNarrativeSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { TextareaField } from "@/components/alumni/form-fields";

export type NarrativeDefaults = {
  startup_involvement: string;
  advisory_roles: string;
  secondary_employment: string;
};

export function NarrativeSectionForm({
  id,
  defaults,
}: {
  id: number;
  defaults: NarrativeDefaults;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateNarrativeSection.bind(null, id),
    null,
  );
  const errors = state?.fieldErrors ?? {};

  return (
    <FocusedEditForm
      title="Narrative"
      note="Provisional: the secondary-affiliation fields below are free-text context and may be reworked."
      formAction={formAction}
      pending={pending}
      error={state?.error}
      cancelHref={`/alumni/${id}`}
      pickerHref={`/alumni/${id}/edit`}
    >
      <TextareaField
        label="Startup involvement"
        name="startup_involvement"
        defaultValue={defaults.startup_involvement}
        error={errors.startup_involvement}
      />
      <TextareaField
        label="Advisory roles"
        name="advisory_roles"
        defaultValue={defaults.advisory_roles}
        error={errors.advisory_roles}
      />
      <TextareaField
        label="Secondary employment"
        name="secondary_employment"
        defaultValue={defaults.secondary_employment}
        error={errors.secondary_employment}
      />
    </FocusedEditForm>
  );
}
