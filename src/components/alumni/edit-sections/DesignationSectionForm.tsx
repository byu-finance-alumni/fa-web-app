"use client";

import { useActionState } from "react";
import {
  updateDesignationSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { Field, Checkbox } from "@/components/alumni/form-fields";

export type DesignationDefaults = {
  /** Checked when a CFA designation string is already on file. */
  cfa: boolean;
  cfp: boolean;
  other_designations: string;
};

export function DesignationSectionForm({
  id,
  defaults,
}: {
  id: number;
  defaults: DesignationDefaults;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateDesignationSection.bind(null, id),
    null,
  );
  const errors = state?.fieldErrors ?? {};

  return (
    <FocusedEditForm
      title="Add Designation / Certificate"
      formAction={formAction}
      pending={pending}
      error={state?.error}
      cancelHref={`/alumni/${id}`}
      pickerHref={`/alumni/${id}/edit`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Checkbox
          label="CFA"
          name="cfa_designation"
          defaultChecked={defaults.cfa}
        />
        <Checkbox
          label="CFP"
          name="cfp_designation"
          defaultChecked={defaults.cfp}
        />
      </div>
      <Field
        label="Other"
        name="other_designations"
        defaultValue={defaults.other_designations}
        error={errors.other_designations}
        placeholder="e.g. CPA (Utah), FRM"
      />
    </FocusedEditForm>
  );
}
