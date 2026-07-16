"use client";

import { useActionState } from "react";
import {
  updateEmploymentSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { Field, SelectField } from "@/components/alumni/form-fields";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import { useVocabOptions, withValue } from "@/hooks/useVocabOptions";

/** Canonical U.S. regions (mirrors AlumniForm's contact `region` select). */
const REGIONS = [
  "Northeast",
  "Southeast",
  "Midwest",
  "Southwest",
  "West",
] as const;

export type EmploymentDefaults = {
  employment_status: string;
  current_employer: string;
  current_title: string;
  current_industry: string;
  current_industry_secondary: string;
  company_address: string;
  current_city: string;
  current_state: string;
  current_country: string;
  work_email: string;
  linkedin_url: string;
  region: string;
};

export function EmploymentSectionForm({
  id,
  defaults,
}: {
  id: number;
  defaults: EmploymentDefaults;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateEmploymentSection.bind(null, id),
    null,
  );
  const errors = state?.fieldErrors ?? {};
  // Same editable-vocabulary Industry dropdown the full AlumniForm uses.
  const industryOptions = useVocabOptions("industry", INDUSTRY_OPTIONS);

  return (
    <FocusedEditForm
      title="Update Employment Information"
      formAction={formAction}
      pending={pending}
      error={state?.error}
      cancelHref={`/alumni/${id}`}
      pickerHref={`/alumni/${id}/edit`}
    >
      <Field
        label="Employment Status"
        name="employment_status"
        defaultValue={defaults.employment_status}
        error={errors.employment_status}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Company"
          name="career.current_employer"
          defaultValue={defaults.current_employer}
          error={errors["career.current_employer"]}
        />
        <Field
          label="Job Title"
          name="career.current_title"
          defaultValue={defaults.current_title}
          error={errors["career.current_title"]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Industry"
          name="career.current_industry"
          options={withValue(industryOptions, defaults.current_industry)}
          defaultValue={defaults.current_industry}
          error={errors["career.current_industry"]}
        />
        <Field
          label="Secondary Industry"
          name="career.current_industry_secondary"
          defaultValue={defaults.current_industry_secondary}
          error={errors["career.current_industry_secondary"]}
        />
      </div>
      <Field
        label="Company address"
        name="career.company_address"
        defaultValue={defaults.company_address}
        error={errors["career.company_address"]}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Employment City"
          name="career.current_city"
          defaultValue={defaults.current_city}
          error={errors["career.current_city"]}
        />
        <Field
          label="Employment State"
          name="career.current_state"
          defaultValue={defaults.current_state}
          error={errors["career.current_state"]}
        />
      </div>
      <Field
        label="Employment Country"
        name="career.current_country"
        defaultValue={defaults.current_country}
        error={errors["career.current_country"]}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Work Email"
          name="contact.work_email"
          type="email"
          defaultValue={defaults.work_email}
          error={errors["contact.work_email"]}
        />
        <SelectField
          label="Region"
          name="contact.region"
          options={withValue(REGIONS, defaults.region)}
          defaultValue={defaults.region}
          error={errors["contact.region"]}
        />
      </div>
      <Field
        label="LinkedIn profile"
        name="linkedin_url"
        defaultValue={defaults.linkedin_url}
        error={errors.linkedin_url}
      />
    </FocusedEditForm>
  );
}
