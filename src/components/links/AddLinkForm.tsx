"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/shared/form-fields";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StateCombobox } from "@/components/alumni/StateCombobox";
import {
  ADD_LINK_LAST_STEP,
  ADD_LINK_STEPS,
  COUNTRY_MAX,
  EMPTY_ADD_LINK_FORM,
  STATE_MAX,
  URL_MAX,
  ROLE_TYPES,
  ROLE_TYPE_LABELS,
  maxReachableAddLinkStep,
  settleOpportunityUrl,
  todayIsoUtc,
  validateAddLink,
  validateAddLinkStep,
  type AddLinkErrors,
  type AddLinkFormValues,
  type LinkRoleType,
} from "@/lib/opportunityLinks";
import {
  createLink,
  searchAlumniForLink,
  type AlumnusOption,
} from "@/app/(app)/links/actions";

/**
 * Staff "Add link" — a full-page two-step wizard.
 *
 * Deliberately the same machine as the Add-event and Add-alumni wizards: a
 * centred column, a text-only "Step n of N · Label" meter over a thin progress
 * bar, one `Section` card per step, and a Back/Cancel — Next/Save footer. Anyone
 * who has added an event should recognise this rather than meet a third pattern.
 *
 * WHY TWO STEPS. Attribution is not one more field among nine: a link exists
 * *because an alumnus offered it*, the company checkbox on step 2 means "resolve
 * the name from THEIR employment record", and the backend rejects a create with
 * no `alumni_id`. Settling who it is from first is what makes the rest of the
 * form make sense, so step 2 cannot be reached — or submitted — without it (see
 * `maxReachableAddLinkStep`, which clamps the step rather than trusting the Next
 * button to be the only door).
 *
 * NOTHING IS LOST GOING BACK. Both steps stay mounted (the inactive one is
 * hidden), all values live in this component's state, and the chosen alumnus is
 * held here rather than inside the picker — so Back, and the "Change" control on
 * step 2, both return to a step that still has everything on it.
 *
 * Staff entry lands APPROVED — a staff member typing a link in IS the review
 * step, so it does not queue behind one. The form says so rather than leaving
 * the reader to infer it from a list that does not show their row.
 *
 * The company field is an either/or, not a pair: ticking "use their current
 * employer" is what tells the backend to RESOLVE the name from the employment
 * record at read time (so it follows a job change), which is a different thing
 * from storing a snapshot of today's employer name. The typed box is therefore
 * disabled while the box is ticked, not merely ignored.
 *
 * Text-only controls (standing project rule). Validation mirrors the backend's
 * shape but is UX only — the server action re-validates and the API is the
 * control.
 */
export function AddLinkForm() {
  const router = useRouter();
  const [values, setValues] = useState<AddLinkFormValues>(EMPTY_ADD_LINK_FORM);
  const [chosenAlum, setChosenAlum] = useState<AlumnusOption | null>(null);
  const [errors, setErrors] = useState<AddLinkErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [requestedStep, setRequestedStep] = useState(0);
  const ids = useId();

  // Today, for the deadline picker's floor. Set after mount rather than during
  // render: this is a client component that Next also renders on the server, and
  // a request that straddles UTC midnight would otherwise hydrate with a `min`
  // that disagrees with the one the server printed. The rule itself does not
  // depend on this — `validateAddLink` re-checks against a fresh clock — so a
  // frame without it costs nothing.
  const [minDeadline, setMinDeadline] = useState<string | undefined>(undefined);
  useEffect(() => {
    setMinDeadline(todayIsoUtc());
  }, []);

  // The step actually rendered. Clamped rather than trusted: clearing the
  // chosen alumnus from step 2 must not leave the reader on a step whose whole
  // premise ("their own company") no longer has an antecedent.
  const step = Math.min(requestedStep, maxReachableAddLinkStep(values));
  const onLastStep = step === ADD_LINK_LAST_STEP;

  // Focus targets for the three fields that can be *wrong* rather than merely
  // empty, so a per-step complaint puts the cursor where the fix goes.
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const focusFirstError = (found: AddLinkErrors) => {
    const first = (
      [
        "alumniId",
        "companyName",
        "url",
        "locationState",
        "locationCountry",
        "applicationDeadline",
      ] as const
    ).find((f) => found[f]);
    if (first) fieldRefs.current[first]?.focus();
  };

  const set = <K extends keyof AddLinkFormValues>(
    key: K,
    value: AddLinkFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear a field's error as soon as it is touched — re-validation happens on
    // Next/submit, so leaving a stale message under a corrected field reads as a
    // bug.
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  /**
   * The URL field, once focus leaves it.
   *
   * Two things happen here and both are the point. The value is NORMALISED —
   * `jakegunnell.com` becomes `https://jakegunnell.com/`, written straight back
   * into the box so what will be saved is what is on screen rather than a
   * surprise discovered later in the table. And it is VALIDATED, so a bad link
   * is named the moment the user moves on instead of surviving until Save.
   *
   * Blur is a convenience, not the gate: `validateAddLink` runs the identical
   * rule on submit (and again in the server action), so a value that never lost
   * focus is judged just the same.
   *
   * An empty box settles silently — "A link is required" belongs to Save, not to
   * tabbing past a field on the way to the one below it.
   */
  const settleUrl = () => {
    if (values.url.trim() === "") {
      setErrors((prev) => ({ ...prev, url: undefined }));
      return;
    }
    const { value, error } = settleOpportunityUrl(values.url);
    setValues((prev) => (prev.url === value ? prev : { ...prev, url: value }));
    setErrors((prev) => ({ ...prev, url: error ?? undefined }));
  };

  const goNext = () => {
    const found = validateAddLinkStep(values, step);
    if (Object.values(found).some(Boolean)) {
      // Only this step's complaints, so nothing surfaces about a field the
      // reader has not been shown yet.
      setErrors((prev) => ({ ...prev, ...found }));
      focusFirstError(found);
      return;
    }
    setSubmitError(null);
    setRequestedStep(Math.min(step + 1, ADD_LINK_LAST_STEP));
  };

  const goBack = () => {
    setSubmitError(null);
    setRequestedStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter inside a step-1 field must advance, never save a half-filled form.
    if (!onLastStep) {
      goNext();
      return;
    }
    setSubmitError(null);
    const found = validateAddLink(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      // A complaint about the attribution belongs on step 1 — jump back to it
      // rather than printing a message on a step that has no such field.
      const earliest = found.alumniId ? 0 : ADD_LINK_LAST_STEP;
      setRequestedStep(earliest);
      focusFirstError(found);
      return;
    }

    startSubmit(async () => {
      const result = await createLink(values);
      if (result.ok) {
        router.push("/links");
        router.refresh();
      } else {
        setSubmitError(result.error);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-2xl">
      {/* Progress. Text plus a bar — no icons, per the standing project rule. */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Step {step + 1} of {ADD_LINK_STEPS.length} · {ADD_LINK_STEPS[step]}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-brand-blue-600 transition-all"
            style={{
              width: `${((step + 1) / ADD_LINK_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Both steps stay mounted so returning to one finds it as it was left. */}
      <div className={step === 0 ? "" : "hidden"}>
        <Section title="Who this is from">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Every link is attributed to the alumnus who offered it, so students
              know who to mention and staff know who to thank. Pick them before
              describing the opportunity.
            </p>
            <AlumnusPicker
              chosen={chosenAlum}
              onChoose={(option) => {
                setChosenAlum(option);
                set("alumniId", option?.alumni_id ?? null);
              }}
              error={errors.alumniId}
              inputId={`${ids}-alum`}
              inputRef={(el) => {
                fieldRefs.current.alumniId = el;
              }}
            />
          </div>
        </Section>
      </div>

      <div className={onLastStep ? "" : "hidden"}>
        <Section title="The opportunity">
          <div className="space-y-4">
            {chosenAlum ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">
                  From <span className="font-semibold text-gray-900">
                    {chosenAlum.name}
                  </span>
                  {chosenAlum.detail ? (
                    <span className="text-gray-500"> · {chosenAlum.detail}</span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={goBack}
                >
                  Change
                </Button>
              </div>
            ) : null}

            <fieldset className="rounded-md border border-gray-200 p-3">
              <legend className="px-1 text-xs font-medium text-gray-700">
                Company
              </legend>
              <label className="flex items-start gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={values.isOwnCompany}
                  onChange={(e) => {
                    set("isOwnCompany", e.target.checked);
                    if (e.target.checked) set("companyName", "");
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                />
                <span>
                  This is their own company
                  <span className="mt-0.5 block text-xs text-gray-500">
                    The list shows their current employer from their record, so
                    it follows a job change instead of freezing today&apos;s
                    name.
                  </span>
                </span>
              </label>

              <div className="mt-3">
                <Label className="mb-1.5" htmlFor={`${ids}-company`}>
                  Company name
                </Label>
                <Input
                  id={`${ids}-company`}
                  ref={(el) => {
                    fieldRefs.current.companyName = el;
                  }}
                  value={values.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  disabled={values.isOwnCompany}
                  placeholder={
                    values.isOwnCompany
                      ? "Resolved from their employer record"
                      : "e.g. Goldman Sachs"
                  }
                  aria-invalid={errors.companyName ? true : undefined}
                />
                <FieldError message={errors.companyName} />
              </div>
            </fieldset>

            <div>
              <Label className="mb-1.5" htmlFor={`${ids}-url`}>
                Link URL
              </Label>
              <Input
                id={`${ids}-url`}
                ref={(el) => {
                  fieldRefs.current.url = el;
                }}
                value={values.url}
                onChange={(e) => set("url", e.target.value)}
                onBlur={settleUrl}
                placeholder="https://example.com/careers"
                inputMode="url"
                maxLength={URL_MAX}
                aria-invalid={errors.url ? true : undefined}
              />
              <FieldError message={errors.url} />
              <p className="mt-1 text-xs text-gray-500">
                A bare domain is fine: type <code>jakegunnell.com</code> and
                it&apos;s saved as <code>https://jakegunnell.com/</code>. A
                careers page outlasts a single posting.
              </p>
            </div>

            <fieldset className="rounded-md border border-gray-200 p-3">
              <legend className="px-1 text-xs font-medium text-gray-700">
                Location
              </legend>
              {/*
                Text-only toggle (standing project rule), and a checkbox rather
                than a pair of buttons because it is one binary fact about the
                job, not a choice between two destinations.

                NOTHING IS LOST EITHER WAY. The picked state and the typed
                region live in two different slots, so flipping this back and
                forth restores whichever one the mode owns and `toCreateBody`
                sends only the one on screen.
              */}
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={values.isOutsideUS}
                  onChange={(e) => {
                    set("isOutsideUS", e.target.checked);
                    // The controls under this changed; a message about the one
                    // that just left the screen would have nothing to point at.
                    setErrors((prev) => ({
                      ...prev,
                      locationState: undefined,
                      locationCountry: undefined,
                    }));
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                />
                Outside the United States
              </label>

              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-1.5" htmlFor={`${ids}-city`}>
                    City
                  </Label>
                  <Input
                    id={`${ids}-city`}
                    value={values.locationCity}
                    onChange={(e) => set("locationCity", e.target.value)}
                    placeholder={
                      values.isOutsideUS ? "e.g. Toronto" : "e.g. Provo"
                    }
                  />
                </div>
                {values.isOutsideUS ? (
                  <div>
                    <Label className="mb-1.5" htmlFor={`${ids}-region`}>
                      Region or province
                    </Label>
                    <Input
                      id={`${ids}-region`}
                      ref={(el) => {
                        fieldRefs.current.locationState = el;
                      }}
                      value={values.locationRegion}
                      onChange={(e) => {
                        set("locationRegion", e.target.value);
                        // The region's message lives in the `locationState`
                        // slot (the two share a position), so `set`'s
                        // clear-on-touch would miss it.
                        setErrors((prev) => ({
                          ...prev,
                          locationState: undefined,
                        }));
                      }}
                      maxLength={STATE_MAX}
                      placeholder="e.g. Ontario"
                      aria-invalid={errors.locationState ? true : undefined}
                    />
                    <FieldError message={errors.locationState} />
                  </div>
                ) : (
                  // The same states list the alumni Employment and Personal
                  // forms use, so the spelling staff filter on stays one
                  // spelling — and a dropdown takes the free-text character
                  // rules out of play here entirely. Remounted from the stored
                  // value on every toggle, which is what makes the round trip
                  // lossless.
                  <StateCombobox
                    label="State"
                    name={`${ids}-state`}
                    defaultValue={values.locationState}
                    error={errors.locationState}
                    onType={(raw) => set("locationState", raw)}
                    onSettle={(v) => set("locationState", v)}
                  />
                )}
              </div>

              {values.isOutsideUS ? (
                <div className="mt-4 md:max-w-xs">
                  <Label className="mb-1.5" htmlFor={`${ids}-country`}>
                    Country
                  </Label>
                  <Input
                    id={`${ids}-country`}
                    ref={(el) => {
                      fieldRefs.current.locationCountry = el;
                    }}
                    value={values.locationCountry}
                    onChange={(e) => set("locationCountry", e.target.value)}
                    maxLength={COUNTRY_MAX}
                    placeholder="e.g. Canada"
                    aria-invalid={errors.locationCountry ? true : undefined}
                  />
                  <FieldError message={errors.locationCountry} />
                </div>
              ) : null}
            </fieldset>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1.5" htmlFor={`${ids}-role`}>
                  Role type
                </Label>
                <Select
                  id={`${ids}-role`}
                  value={values.roleType}
                  onChange={(e) =>
                    set("roleType", e.target.value as LinkRoleType)
                  }
                  style={{ colorScheme: "light" }}
                >
                  {ROLE_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_TYPE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="mb-1.5" htmlFor={`${ids}-deadline`}>
                  Application deadline (optional)
                </Label>
                <Input
                  id={`${ids}-deadline`}
                  ref={(el) => {
                    fieldRefs.current.applicationDeadline = el;
                  }}
                  type="date"
                  value={values.applicationDeadline}
                  // Discourages a past date in the picker itself. The rule is
                  // enforced by `validateAddLink`, which mirrors the server:
                  // today is fine, only earlier is refused.
                  min={minDeadline}
                  onChange={(e) => set("applicationDeadline", e.target.value)}
                  style={{ colorScheme: "light" }}
                  aria-invalid={errors.applicationDeadline ? true : undefined}
                />
                <FieldError message={errors.applicationDeadline} />
              </div>
            </div>

            <div>
              <Label className="mb-1.5" htmlFor={`${ids}-details`}>
                Details (optional)
              </Label>
              <Textarea
                id={`${ids}-details`}
                value={values.details}
                onChange={(e) => set("details", e.target.value)}
                rows={4}
                placeholder="What the role is, who to mention, anything a student should know before applying."
              />
            </div>
          </div>
        </Section>
      </div>

      {submitError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger-600">
          {submitError}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={goBack}>
            Back
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href="/links">Cancel</Link>
          </Button>
        )}

        <div className="flex items-center gap-3">
          {onLastStep ? (
            <>
              <p className="hidden text-xs text-gray-500 sm:block">
                Staff-added links are approved straight away.
              </p>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save link"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="primary" onClick={goNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-danger-600">
      {message}
    </p>
  );
}

/**
 * Typeahead over the alumni list. Debounced, and every result is rendered as
 * plain text in a button — there is no free-text id entry, so the attribution
 * can only ever be a record that actually exists.
 *
 * The CHOICE is owned by the form, not by this component: step 2 shows who the
 * link is from, and Back has to find the picker exactly as it was left.
 */
function AlumnusPicker({
  chosen,
  onChoose,
  error,
  inputId,
  inputRef,
}: {
  chosen: AlumnusOption | null;
  onChoose: (option: AlumnusOption | null) => void;
  error?: string;
  inputId: string;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<AlumnusOption[]>([]);
  const [isSearching, startSearch] = useTransition();
  // Drops a stale response that resolves after a newer one — otherwise a slow
  // request for "ma" can overwrite the results for "marcus".
  const requestSeq = useRef(0);

  useEffect(() => {
    if (chosen) return;
    const q = term.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      const seq = ++requestSeq.current;
      startSearch(async () => {
        const results = await searchAlumniForLink(q);
        if (seq === requestSeq.current) setOptions(results);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, chosen]);

  if (chosen) {
    return (
      <div>
        <Label className="mb-1.5">Alumnus</Label>
        <div className="flex items-center justify-between gap-3 rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
          <span className="text-sm text-gray-900">
            <span className="font-semibold">{chosen.name}</span>
            {chosen.detail ? (
              <span className="text-gray-500"> · {chosen.detail}</span>
            ) : null}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              onChoose(null);
              setTerm("");
              setOptions([]);
            }}
          >
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className="mb-1.5" htmlFor={inputId}>
        Alumnus
      </Label>
      <Input
        id={inputId}
        ref={inputRef}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search by name"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
      />
      <FieldError message={error} />
      {term.trim().length >= 2 ? (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white">
          {isSearching && options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">Searching…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No matching alumni.</p>
          ) : (
            <ul>
              {options.map((o) => (
                <li key={o.alumni_id}>
                  <button
                    type="button"
                    onClick={() => onChoose(o)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-brand-blue-50 focus-visible:bg-brand-blue-50 focus-visible:outline-none"
                  >
                    <span className="font-medium text-gray-900">{o.name}</span>
                    {o.detail ? (
                      <span className="text-gray-500"> · {o.detail}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
