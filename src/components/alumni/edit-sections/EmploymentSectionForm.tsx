"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateEmploymentSection,
  type FormState,
} from "@/app/(app)/alumni/actions";
import { FocusedEditForm } from "@/components/alumni/FocusedEditForm";
import { Checkbox, Field, SelectField } from "@/components/alumni/form-fields";
import { RegionSelect } from "@/components/alumni/RegionSelect";
import { SecondaryIndustryCombobox } from "@/components/alumni/SecondaryIndustryCombobox";
import { StateCombobox } from "@/components/alumni/StateCombobox";
import {
  EMPLOYMENT_STATUS_OPTIONS,
  MILITARY_INDUSTRY,
  PRIMARY_INDUSTRY_OPTIONS,
  suggestMilitaryIndustry,
} from "@/constants/dropdowns";
import {
  useStateRegions,
  useVocabOptions,
  withValue,
} from "@/hooks/useVocabOptions";
import { regionForState, regionForTypedState } from "@/lib/geo/state-field";
import { validateLinkedinUrl } from "@/lib/urlSafety";

export type EmploymentDefaults = {
  employment_status: string;
  current_employer: string;
  current_title: string;
  current_industry: string;
  current_industry_secondary: string;
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
  // Inline LinkedIn validation (api #418), on the SAME `validateLinkedinUrl`
  // "Add alumni" uses — edit must never be laxer than create, and this section
  // owns the only other staff-facing input for the column. Arranged exactly like
  // the name rules in `PersonalSectionForm`: a client-error map merged over the
  // server's 422 field errors, checked on blur and again pre-submit.
  //
  // This is FEEDBACK, not the guard. The backend re-validates on write, and the
  // render sites scheme-check whatever is already stored — see `@/lib/urlSafety`.
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const errors = { ...(state?.fieldErrors ?? {}), ...clientErrors };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const raw = new FormData(e.currentTarget).get("linkedin_url");
    const msg = validateLinkedinUrl(typeof raw === "string" ? raw : "");
    setClientErrors(msg ? { linkedin_url: msg } : {});
    if (!msg) return;
    // preventDefault stops React from invoking the server action.
    e.preventDefault();
    const el = e.currentTarget.elements.namedItem("linkedin_url");
    if (el instanceof HTMLElement) el.focus();
  };
  // Clear the inline error as soon as the value becomes valid on blur.
  const handleLinkedinBlur = (_name: string, value: string) => {
    const msg = validateLinkedinUrl(value);
    setClientErrors((prev) => {
      if (prev.linkedin_url === msg || (!prev.linkedin_url && !msg)) return prev;
      return msg ? { linkedin_url: msg } : {};
    });
  };
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
  //     lenient resolve would flash "Midwest" before landing on "Mountain West".
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

  // --- Military status suggests the Military industry (#608) ---------------
  // Status and industry are independent columns, so someone can be Military by
  // status with no industry recorded and then never appear in an industry search
  // for Military. This closes that gap the same way the Region auto-fill above
  // does: SUGGEST, announce it with a hint, and let the user override.
  //
  // It fires ONLY on a user change of the status select — never on load, never
  // on save — so a value the user has since edited is not re-suggested over the
  // top, and nothing is written behind their back. `suggestMilitaryIndustry`
  // owns the rules: empty primary gets it, an already-filled primary sends it to
  // the empty SECONDARY slot (the reservist case), both filled suggests nothing,
  // and a non-Military status suggests nothing at all — so switching away never
  // strips a Military industry the user chose.
  const [status, setStatus] = useState(defaults.employment_status);
  const [industry, setIndustry] = useState(defaults.current_industry);
  const [secondaryIndustry, setSecondaryIndustry] = useState(
    defaults.current_industry_secondary,
  );
  const [industrySuggested, setIndustrySuggested] = useState(false);
  const [secondarySuggested, setSecondarySuggested] = useState(false);

  // --- Add a new role, archive the old one (api #446) ----------------------
  // Reworked from the first cut, which asked the user to overwrite Company and
  // Job Title in place while a checkbox further down the form quietly decided
  // whether the outgoing values were kept. Jake asked for the LinkedIn shape
  // instead: you ADD a position and the one you had becomes a past role.
  //
  // So the box sits at the TOP of the section, above the two fields it acts on,
  // and ticking it changes what those fields ARE:
  //
  //  - OFF (the default, and the common case): they are the normal current-role
  //    fields, pre-filled from the record, and saving overwrites in place. This
  //    is the typo-correction path and it must stay untouched.
  //  - ON: the stored company and title become a read-only summary of the role
  //    being filed away, and the inputs below them are a BLANK pair for the new
  //    role. Blank on purpose — pre-filling them would be the overwrite-in-place
  //    behaviour this replaces, dressed up as something else.
  //
  // The `key` on the wrapper is what makes "blank" true: without a remount React
  // keeps the DOM node (same element type, same position) and an uncontrolled
  // input ignores the changed `defaultValue`, so the old company would still be
  // sitting in the box.
  //
  // Only Company and Job Title swap. The rest of the career fields (industry,
  // location, work email) stay pre-filled and editable either way: the backend
  // drops blanks from a partial patch, so emptying them would carry the old
  // values onto the new role regardless — an empty input there would promise
  // something it can't deliver.
  const [archiveCurrentRole, setArchiveCurrentRole] = useState(false);
  // Nothing to archive with no employer AND no title on file. The box is
  // DISABLED rather than hidden — same treatment `PreferredContactPicker` gives
  // an option whose field is empty — so the control keeps a fixed place in the
  // section and says why it can't be used, instead of appearing and vanishing
  // between records. A disabled input is also never serialised, so the flag
  // cannot reach the server on a record with no role to file away.
  const hasCurrentRole = Boolean(
    defaults.current_employer || defaults.current_title,
  );
  const archiving = archiveCurrentRole && hasCurrentRole;

  function onStatusChange(next: string) {
    setStatus(next);
    const slot = suggestMilitaryIndustry(next, industry, secondaryIndustry);
    if (slot === "current_industry") {
      setIndustry(MILITARY_INDUSTRY);
      setIndustrySuggested(true);
    } else if (slot === "current_industry_secondary") {
      setSecondaryIndustry(MILITARY_INDUSTRY);
      setSecondarySuggested(true);
    }
  }

  return (
    <FocusedEditForm
      title="Update Employment Information"
      formAction={formAction}
      pending={pending}
      error={state?.error}
      cancelHref={`/alumni/${id}`}
      pickerHref={`/alumni/${id}/edit`}
      onSubmit={handleSubmit}
    >
      {/* The full eight-option staff list (#568/#377) — the survey shows one
          fewer, withholding "Unknown". A record holding a legacy free-text
          status ("Employed") keeps it as a selectable option via `withValue`,
          so editing the company can't rewrite the status. */}
      <SelectField
        label="Employment Status"
        name="employment_status"
        options={withValue(
          EMPLOYMENT_STATUS_OPTIONS,
          defaults.employment_status,
        )}
        value={status}
        onChange={onStatusChange}
        error={errors.employment_status}
      />
      {/* Archive the outgoing role (api #446). Sits ABOVE Company/Job Title
          because it decides what those two fields are — an editor for the
          current role, or a blank slot for a new one.

          NO `defaultChecked` and nothing in `EmploymentDefaults` feeds it: this
          box is deliberately not stored state, so it starts OFF on every load
          of every record. Archiving is never inferred from the employer string
          changing — a typo correction would then manufacture a job the alum
          never left — so the person editing has to say so each time.

          Ticking it alone changes nothing; the backend only archives when the
          save actually alters the career fields. */}
      <Checkbox
        label="Archive current role"
        name="archive_previous_role"
        disabled={!hasCurrentRole}
        onChange={setArchiveCurrentRole}
        hint={
          hasCurrentRole
            ? "Files the stored company and title in employment history, then records the new role you enter below as the current one. Leave it off when you're only correcting a typo."
            : "No current role on file, so there is nothing to file away. Enter the company and job title below to record this alum's first role."
        }
      />
      <div
        // Remounts the pair when the box moves, so the new-role inputs really
        // do come up empty rather than keeping the value React left in the DOM.
        key={archiving ? "new-role" : "current-role"}
        className="space-y-4"
      >
        {archiving ? (
          <div className="rounded-md border border-gray-300 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-700">
              Moving to employment history
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-gray-500">Company</dt>
                <dd className="text-sm text-gray-900">
                  {defaults.current_employer || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Job Title</dt>
                <dd className="text-sm text-gray-900">
                  {defaults.current_title || "—"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
        {/* `space-y-1.5` matches FieldLabel's `mb-1.5`, so "New role" sits on
            the pair the way a field label sits on its input. */}
        <div className="space-y-1.5">
          {archiving ? (
            <p className="text-xs font-medium text-gray-700">New role</p>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <Field
            label="Company"
              name="career.current_employer"
              // Blank under the new-role heading; the stored value only ever
              // pre-fills the in-place editor.
              defaultValue={archiving ? "" : defaults.current_employer}
              error={errors["career.current_employer"]}
            />
            <Field
              label="Job Title"
              name="career.current_title"
              defaultValue={archiving ? "" : defaults.current_title}
              error={errors["career.current_title"]}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Industry"
          name="career.current_industry"
          // A record whose stored primary is one of the four now hidden from
          // this list (the rows the #282 data migration deliberately skips) keeps
          // it as a selectable option — editing employment must not blank it.
          options={withValue(primaryIndustryOptions, defaults.current_industry)}
          value={industry}
          onChange={(v) => {
            setIndustry(v);
            // A manual pick is an override — retract the note so the hint never
            // describes a value the user chose themselves.
            setIndustrySuggested(false);
          }}
          hint={
            industrySuggested
              ? "Suggested from Employment Status. Change or clear it if that's not right."
              : undefined
          }
          error={errors["career.current_industry"]}
        />
        {/* Pick-or-type: this column is free text on the backend, so the full
            21-option list is a suggestion, not a constraint (#452). */}
        <SecondaryIndustryCombobox
          // Sentence case (#683) to match the add-alumni form, the profile
          // field, the search facet, and the survey — "Secondary industry" is
          // the spelling everywhere else in the app.
          label="Secondary industry"
          name="career.current_industry_secondary"
          value={secondaryIndustry}
          onChange={(v) => {
            setSecondaryIndustry(v);
            setSecondarySuggested(false);
          }}
          hint={
            secondarySuggested
              ? "Suggested from Employment Status. Change or clear it if that's not right."
              : undefined
          }
          error={errors["career.current_industry_secondary"]}
        />
      </div>
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
              ? "Set from Employment State. Change it if that's not right."
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
        onBlur={handleLinkedinBlur}
        hint="Full URL, e.g. https://www.linkedin.com/in/you"
      />
    </FocusedEditForm>
  );
}
