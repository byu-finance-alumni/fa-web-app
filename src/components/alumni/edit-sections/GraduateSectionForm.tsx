"use client";

import { useActionState, useState } from "react";
import {
  updateGraduateSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { Field, FieldLabel } from "@/components/alumni/form-fields";
import { Select } from "@/components/ui/select";

/** The four degree buckets; "Other" reveals a free-text "Specify" input. */
const DEGREES = ["MBA", "Law", "Medical", "Other"] as const;

export type GraduateDefaults = {
  employment_status: string;
  /** One of DEGREES, or "" when no graduate degree is on file. */
  degree_choice: string;
  /** Free text shown/saved only when degree_choice === "Other". */
  degree_other: string;
  graduate_school: string;
  graduate_graduation_year: string;
};

export function GraduateSectionForm({
  id,
  defaults,
}: {
  id: number;
  defaults: GraduateDefaults;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateGraduateSection.bind(null, id),
    null,
  );
  const errors = state?.fieldErrors ?? {};
  const [choice, setChoice] = useState(defaults.degree_choice);

  return (
    <FocusedEditForm
      title="Add Graduate Program"
      formAction={formAction}
      pending={pending}
      error={state?.error}
      cancelHref={`/alumni/${id}`}
      pickerHref={`/alumni/${id}/edit`}
    >
      <Field
        label="Employment status (shared with Employment)"
        name="employment_status"
        defaultValue={defaults.employment_status}
        error={errors.employment_status}
      />
      <div>
        <FieldLabel htmlFor="graduate_degree_choice">
          Graduate Program degree
        </FieldLabel>
        <Select
          id="graduate_degree_choice"
          name="graduate_degree_choice"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">—</option>
          {DEGREES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>
      {choice === "Other" ? (
        <Field
          label="Specify program (e.g. MAcc, PhD)"
          name="graduate_degree_other"
          defaultValue={defaults.degree_other}
          error={errors.graduate_degree}
        />
      ) : null}
      <Field
        label="Graduate Program university"
        name="graduate_school"
        defaultValue={defaults.graduate_school}
        error={errors.graduate_school}
      />
      <Field
        label="Graduation Year"
        name="graduate_graduation_year"
        type="number"
        defaultValue={defaults.graduate_graduation_year}
        error={errors.graduate_graduation_year}
      />
    </FocusedEditForm>
  );
}
