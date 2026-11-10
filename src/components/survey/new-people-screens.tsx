"use client";

/**
 * The new-people survey's screens (api#661): intro, the first question, one
 * wizard page, the closed-link panel and the honeypot. View only: no fetches,
 * no submit. `app/survey/new/[key]/page.tsx` owns the data.
 *
 * The questions themselves render through the live survey's `FieldControl` and
 * `SurveyCommentsBox`, so a respondent here meets exactly the controls an alum
 * meets on `/survey/[token]`. No icons anywhere: text buttons only.
 */
import { Fragment, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  FieldControl,
  SurveyCommentsBox,
  type EditField,
} from "@/components/survey/survey-screens";
import {
  NEW_PEOPLE_INTRO_PARAGRAPHS,
  NEW_PEOPLE_INTRO_SIGNOFF,
  NEW_PEOPLE_LINK_CLOSED,
  NEW_PERSON_KIND_OPTIONS,
  type NewPeoplePage,
} from "@/lib/newPeopleSurvey";
import type { NewPersonKind } from "@/types/new-people-survey";

const HEADING = "text-3xl font-semibold leading-tight tracking-tight text-navy-800";

export function NewPeopleIntro({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <h1 className={HEADING}>Stay connected with BYU Finance</h1>
      <div className="mt-6 max-w-prose space-y-4 text-base leading-relaxed text-gray-700">
        {NEW_PEOPLE_INTRO_PARAGRAPHS.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p>
          {NEW_PEOPLE_INTRO_SIGNOFF.map((line, i) => (
            <Fragment key={line}>
              {i > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </p>
      </div>
      <div className="mt-8">
        <Button type="button" variant="navy" size="lg" onClick={onStart}>
          Start the survey
        </Button>
      </div>
    </div>
  );
}

export function NewPeopleKindPicker({
  onPick,
  onBack,
}: {
  onPick: (kind: NewPersonKind) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h1 className={HEADING}>Which describes you?</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {NEW_PERSON_KIND_OPTIONS.map((o) => (
          <button
            key={o.kind}
            type="button"
            onClick={() => onPick(o.kind)}
            className="rounded-lg border-2 border-gray-200 bg-white px-6 py-8 text-center text-lg font-semibold text-navy-800 transition-colors hover:border-brand-blue-500 hover:bg-brand-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-8">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

/**
 * One page of the wizard. A `<form>` so Enter in a text box means Next, and
 * `noValidate` so the browser's own bubbles never compete with the inline
 * messages: requiredness is the server's list, checked by the page.
 */
export function NewPeopleWizardPage({
  page,
  stepNumber,
  stepCount,
  fields,
  valueOf,
  setValue,
  errors,
  onBlurField,
  comments,
  setComments,
  isLast,
  onBack,
  onNext,
  submitting,
  submitError,
}: {
  page: NewPeoplePage;
  stepNumber: number;
  stepCount: number;
  /** The page's fields with `required` already set from the server's groups. */
  fields: EditField[];
  valueOf: (key: string) => string;
  setValue: (key: string, value: string) => void;
  errors: Record<string, string>;
  onBlurField: (field: EditField) => void;
  comments: string;
  setComments: (v: string) => void;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext();
  };
  const hasRequired = fields.some((f) => f.required);
  return (
    <form noValidate onSubmit={handleSubmit}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Step {stepNumber} of {stepCount}
      </p>
      <h1 className={`mt-1 ${HEADING}`}>{page.title}</h1>
      {page.blurb ? (
        <p className="mt-3 max-w-prose text-base leading-relaxed text-gray-600">
          {page.blurb}
        </p>
      ) : null}
      {hasRequired ? (
        <p className="mt-2 text-sm text-gray-500">
          Questions marked <span className="text-danger-600">*</span> are required.
        </p>
      ) : null}

      {page.id === "comments" ? (
        <section className="mt-6">
          <SurveyCommentsBox value={comments} onChange={setComments} />
        </section>
      ) : (
        <div className="mt-6 space-y-5 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
          {fields.map((f) => (
            <FieldControl
              key={f.key}
              field={f}
              value={valueOf(f.key)}
              onFileValue=""
              onChange={(v) => setValue(f.key, v)}
              onBlur={() => onBlurField(f)}
              error={errors[f.key]}
            />
          ))}
        </div>
      )}

      {Object.keys(errors).length > 0 ? (
        <p role="alert" className="mt-4 text-sm text-danger-600">
          Please fix the highlighted questions before going on.
        </p>
      ) : null}

      <div className="mt-10 border-t border-gray-200 pt-8">
        {submitError ? (
          <p role="alert" className="mb-4 text-sm text-danger-600">
            {submitError}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
            Back
          </Button>
          <Button type="submit" variant="navy" size="lg" disabled={submitting}>
            {isLast ? (submitting ? "Submitting…" : "Submit") : "Next"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function NewPeopleClosedPanel() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center sm:p-10">
      <h1 className="text-xl font-semibold tracking-tight text-navy-800">
        {NEW_PEOPLE_LINK_CLOSED}
      </h1>
    </div>
  );
}

export function NewPeopleLoadFailedPanel() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center sm:p-10">
      <h1 className="text-xl font-semibold tracking-tight text-navy-800">
        We couldn&apos;t load this survey
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600">
        Please refresh the page to try again.
      </p>
    </div>
  );
}

/**
 * The bot check: a text box named `website` that a person never sees or reaches.
 * Off-screen rather than `display:none` (some bots skip hidden inputs), out of
 * the tab order, hidden from screen readers, and with autofill off so a
 * browser never fills it on someone's behalf. Anything typed here makes the
 * server accept the POST and store nothing.
 */
export function NewPeopleHoneypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
    >
      <label htmlFor="new-people-website">Website</label>
      <input
        id="new-people-website"
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

