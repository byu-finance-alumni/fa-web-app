"use client";

import { useActionState } from "react";
import {
  updateEngagementSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { Checkbox, TextareaField } from "@/components/alumni/form-fields";

/** Label → engagement flag, in display order. */
const FLAGS: { label: string; flag: string }[] = [
  { label: "Willing to host NetTrek", flag: "nettrek_host_willing" },
  { label: "Willing to mentor", flag: "mentor_willing" },
  { label: "Willing to guest speak", flag: "guest_speaker_willing" },
  {
    label: "Willing to host case competition",
    flag: "case_competition_host_willing",
  },
  {
    label: "Willing to attend finance conference",
    flag: "finance_conference_willing",
  },
  {
    label: "Willing to sponsor company event",
    flag: "company_event_sponsor_willing",
  },
  {
    label: "Willing to mentor Women in Finance",
    flag: "women_in_finance_mentor_willing",
  },
  { label: "Willing to donate to PIFF", flag: "piff_donor" },
  { label: "Hired a Finance Intern", flag: "hired_finance_intern" },
  {
    label: "Hired a full-time Finance student",
    flag: "hired_finance_full_time",
  },
  { label: "Willing to help at an event", flag: "help_at_event_willing" },
];

export type EngagementDefaults = {
  flags: Record<string, boolean>;
  engagement_notes: string;
};

export function EngagementSectionForm({
  id,
  defaults,
}: {
  id: number;
  defaults: EngagementDefaults;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateEngagementSection.bind(null, id),
    null,
  );

  return (
    <FocusedEditForm
      title="Add Engagement"
      formAction={formAction}
      pending={pending}
      error={state?.error}
      cancelHref={`/alumni/${id}`}
      pickerHref={`/alumni/${id}/edit`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FLAGS.map(({ label, flag }) => (
          <Checkbox
            key={flag}
            label={label}
            name={`engagement.${flag}`}
            defaultChecked={defaults.flags[flag] ?? false}
          />
        ))}
      </div>
      <TextareaField
        label="Engagement Notes"
        name="engagement.engagement_notes"
        defaultValue={defaults.engagement_notes}
      />
    </FocusedEditForm>
  );
}
