"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateEmploymentSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { Field, SelectField } from "@/components/alumni/form-fields";
import { RegionSelect } from "@/components/alumni/RegionSelect";
import { SecondaryIndustryCombobox } from "@/components/alumni/SecondaryIndustryCombobox";
import { StateCombobox } from "@/components/alumni/StateCombobox";
import { PRIMARY_INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import {
  useStateRegions,
  useVocabOptions,
  withValue,
} from "@/hooks/useVocabOptions";
import { regionForState, regionForTypedState } from "@/lib/geo/state-field";

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
  // Same editable-vocabulary Industry dropdown the full AlumniForm uses, on the
  // `scope=primary` list #452 introduced — it hides the four secondary-only
  // industries. The secondary field fetches the full list for itself (see
  // SecondaryIndustryCombobox), since it's a combobox, not a strict select.
  const primaryIndustryOptions = useVocabOptions(
    "industry",
    PRIMARY_INDUSTRY_OPTIONS,
    true,
    "primary",
  );

  // --- Region follows the Employment State (#451) --------------------------
  // Region is auto-filled from the state the alum WORKS in, using the server's
  // crosswalk (never a map hardcoded here — it would drift from what the server
  // persists). It stays a normal editable dropdown: the auto-fill is a
  // convenience Tanya can override, so we only ever write it on an actual state
  // change and announce it with a hint when we do.
  //
  // The fill runs at two moments, on purpose:
  //
  //  1. WHILE TYPING (`onTypeState`) — the moment the typed text is a complete
  //     state name. "Texas" fills Southwest on the final "s", with no blur, which
  //     is what makes this feel like it works. Restricted to exact full names
  //     (`regionForTypedState`) so mid-word input can't fill a wrong region:
  //     typing "Montana" passes through "Mo" — Missouri's USPS code — and a
  //     lenient resolve would flash "Midwest" before landing on "West".
  //  2. ON SETTLE (blur / picking a suggestion) — the full, lenient resolve,
  //     including code expansion, so "TX" also lands on Southwest.
  //
  // Neither path ever BLANKS the region: an unresolvable state (half-typed
  // "Tex", an international province, or the crosswalk still in flight) leaves
  // whatever is there, matching `derive_region` server-side, which derives
  // nothing rather than clearing.
  const { regions, regionByState } = useStateRegions();
  const [region, setRegion] = useState(defaults.region);
  const [regionAutoFilled, setRegionAutoFilled] = useState(false);
  // The work state the user has settled on, or null while they haven't touched
  // it. Tracking it (rather than deriving inline on change) keeps the auto-fill
  // correct when the crosswalk is still in flight at the moment of the edit:
  // the effect re-runs when the map lands. `null` is what stops an untouched
  // record from being auto-filled just because the map arrived.
  const [workState, setWorkState] = useState<string | null>(null);

  useEffect(() => {
    if (workState === null) return;
    const next = regionForState(regionByState, workState);
    // No region for a blank / non-US / unrecognized state (an international
    // province has no US region), and none until the crosswalk loads — leave
    // whatever is there rather than blanking it, matching `derive_region`.
    if (next === null) return;
    setRegion(next);
    setRegionAutoFilled(true);
  }, [workState, regionByState]);

  // Per-keystroke fill. Resolving only complete full names means a manual region
  // override survives every keystroke that ISN'T one — the override is only
  // replaced when the user finishes typing a state that names a different
  // region, which is the same "you edited the state, so the region follows"
  // exchange settling already made. Typing on doesn't fight the user; it just
  // stops making them blur to see the result.
  function onTypeState(raw: string) {
    const next = regionForTypedState(regionByState, raw);
    if (next === null) return;
    setRegion(next);
    setRegionAutoFilled(true);
  }

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
          // A record whose stored primary is one of the four now hidden from
          // this list (the rows the #282 data migration deliberately skips) keeps
          // it as a selectable option — editing employment must not blank it.
          options={withValue(primaryIndustryOptions, defaults.current_industry)}
          defaultValue={defaults.current_industry}
          error={errors["career.current_industry"]}
        />
        {/* Pick-or-type: this column is free text on the backend, so the full
            21-option list is a suggestion, not a constraint (#452). */}
        <SecondaryIndustryCombobox
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
        <StateCombobox
          label="Employment State"
          name="career.current_state"
          defaultValue={defaults.current_state}
          error={errors["career.current_state"]}
          onSettle={setWorkState}
          onType={onTypeState}
        />
      </div>
      {/* Region sits directly under Employment State, NOT with the home
          address, because as of #283 that is what drives it: an alum living in
          Idaho but working in New York is "Northeast". The field still writes
          `contact.region` — only its meaning moved, not its column. */}
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Employment Country"
          name="career.current_country"
          defaultValue={defaults.current_country}
          error={errors["career.current_country"]}
        />
        <RegionSelect
          name="contact.region"
          options={withValue(regions, defaults.region)}
          value={region}
          onChange={(v) => {
            setRegion(v);
            // A manual pick is an override — retract the auto-fill note so the
            // hint never describes a value the user chose themselves.
            setRegionAutoFilled(false);
          }}
          error={errors["contact.region"]}
          hint={
            regionAutoFilled
              ? "Set from Employment State — change it if that's not right."
              : "Follows the Employment State. You can override it."
          }
        />
      </div>
      <Field
        label="Work Email"
        name="contact.work_email"
        type="email"
        defaultValue={defaults.work_email}
        error={errors["contact.work_email"]}
      />
      <Field
        label="LinkedIn profile"
        name="linkedin_url"
        defaultValue={defaults.linkedin_url}
        error={errors.linkedin_url}
      />
    </FocusedEditForm>
  );
}
