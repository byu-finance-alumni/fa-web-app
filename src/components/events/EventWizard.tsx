"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared/form-fields";
import { EventFields } from "@/components/events/EventFields";
import type {
  EventPreviewState,
  FormState,
} from "@/app/(app)/events/actions";
import {
  ATTENDEE_PLAN,
  ATTENDEE_PLAN_FIELD,
  EVENT_LAST_DATA_STEP,
  EVENT_REVIEW_STEP,
  EVENT_STEPS,
  EVENT_VALIDATED_FIELDS,
  buildEventSummary,
  readEventValues,
  validateEventDetails,
  validateEventField,
  type AttendeePlan,
  type EventWarning,
} from "@/lib/eventWizard";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type PreviewAction = (
  formData: FormData,
  today: string,
) => Promise<EventPreviewState>;

/** The browser's local date as YYYY-MM-DD (not the server's UTC one). */
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Add event (#611).
 *
 * Deliberately the same shape as the Add-alumni wizard: a centred `max-w-2xl`
 * column, a "Step n of N · Label" meter over a thin progress bar, one `Section`
 * card per step, and a Back/Cancel — Next/Create footer, ending on a Review step
 * that runs a server check before the record is written. Someone who has added
 * an alumnus should recognise this immediately; it is built from the same
 * primitives, not a lookalike.
 *
 * The step that matters is Attendees. Every "Add event" button used to land on
 * the CSV importer, which refuses to proceed without a file — so an event could
 * not be created at all without a roster. Here the roster is never a
 * precondition: "Add attendees later" is the pre-selected default, says so in
 * plain words, and the only thing the choice changes is where you land after
 * saving.
 *
 * Text only — no icons.
 */
export function EventWizard({
  action,
  previewAction,
  eventTypeOptions = [],
  cancelHref = "/events",
  canUploadAttendees = false,
  importHref = null,
}: {
  action: Action;
  /** Server action behind the Review step's duplicate/advisory check. */
  previewAction: PreviewAction;
  /** Managed event-type options (Admin → Vocabulary). */
  eventTypeOptions?: string[];
  cancelHref?: string;
  /**
   * Where the bulk events CSV import lives, or `null` to leave it unmentioned.
   * Gated on `events.import` by the page — a different job from adding one
   * event, and pointing someone without the capability at it just bounces them.
   */
  importHref?: string | null;
  /**
   * Whether to offer "take me to the attendee upload" after saving. Resolved by
   * the page from the viewer's access to that screen — with it off, the step
   * still renders and still creates the event, it just doesn't advertise a
   * destination that would bounce them.
   */
  canUploadAttendees?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Client-side field errors (blur + submit). Server 422 errors merge in below.
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const [plan, setPlan] = useState<AttendeePlan>(ATTENDEE_PLAN.LATER);

  // Review-step state, mirroring the alumni hygiene preview.
  const [warnings, setWarnings] = useState<EventWarning[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPending, startPreview] = useTransition();
  // Snapshot of the values shown on the Review step, taken when it is entered.
  const [summary, setSummary] = useState<ReturnType<
    typeof buildEventSummary
  > | null>(null);

  // Client errors win (freshest input); server field errors fill the rest.
  const errors: Record<string, string> = {
    ...(state?.fieldErrors ?? {}),
    ...clientErrors,
  };

  const handleBlur = (name: string, value: string) => {
    const msg = validateEventField(name, value);
    setClientErrors((prev) => {
      const next = { ...prev };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  };

  const focusFirstError = (
    form: HTMLFormElement,
    found: Record<string, string>,
  ) => {
    const first = EVENT_VALIDATED_FIELDS.find((n) => found[n]);
    if (!first) return;
    const el = form.elements.namedItem(first);
    if (el instanceof HTMLElement) el.focus();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const found = validateEventDetails(new FormData(e.currentTarget));
    if (Object.keys(found).length > 0) {
      e.preventDefault();
      setClientErrors(found);
      // Every validated field lives on the details step — go back so the
      // messages are actually on screen.
      setStep(0);
      focusFirstError(e.currentTarget, found);
    }
  };

  /** Run the Review check against the form as it stands right now. */
  const runPreview = () => {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    setSummary(buildEventSummary(readEventValues(formData)));
    setPreviewError(null);
    const today = localToday();
    startPreview(async () => {
      const result = await previewAction(formData, today);
      if (result.ok) {
        setWarnings(result.preview.warnings);
        setPreviewError(null);
      } else {
        setWarnings(null);
        setPreviewError(result.error);
      }
    });
  };

  const goNext = () => {
    // Gate the required details step before leaving it.
    if (step === 0 && formRef.current) {
      const found = validateEventDetails(new FormData(formRef.current));
      if (Object.keys(found).length > 0) {
        setClientErrors(found);
        focusFirstError(formRef.current, found);
        return;
      }
    }
    const next = Math.min(step + 1, EVENT_REVIEW_STEP);
    if (next === EVENT_REVIEW_STEP) runPreview();
    setStep(next);
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const hasErrors = Object.keys(errors).length > 0;
  const onReview = step === EVENT_REVIEW_STEP;

  /* --- Step 1: the event itself ----------------------------------------- */
  const detailsSection = (
    <Section title="Event details">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          Name and date are all an event needs to exist. Everything else can be
          filled in later.
        </p>
        <EventFields
          errors={errors}
          eventTypeOptions={eventTypeOptions}
          onBlur={handleBlur}
        />
      </div>
    </Section>
  );

  /* --- Step 2: attendees, and the fact they are optional ----------------- */
  const attendeesSection = (
    <Section title="Attendees">
      <fieldset className="space-y-4">
        <legend className="sr-only">What to do about attendees</legend>
        <p className="text-sm text-gray-700">
          An attendee list is never required. The event is created either way —
          this only decides where you land next, and you can change your mind
          from the event at any time.
        </p>
        <div className="space-y-2">
          <PlanOption
            value={ATTENDEE_PLAN.LATER}
            checked={plan === ATTENDEE_PLAN.LATER}
            onSelect={setPlan}
            title="Add attendees later"
            badge="Most common"
            description="Create the event now with nobody on it. You'll land on the event, where you can add people one at a time or upload a list whenever you have one."
          />
          <PlanOption
            value={ATTENDEE_PLAN.UPLOAD}
            checked={plan === ATTENDEE_PLAN.UPLOAD}
            onSelect={setPlan}
            disabled={!canUploadAttendees}
            title="I already have the list"
            description={
              canUploadAttendees
                ? "Go straight to the attendee upload for this event once it's saved. You'll match a list of names and emails against alumni and approve each match."
                : "Your account can't upload attendee lists. Ask an administrator, or add attendees one at a time from the event."
            }
          />
        </div>
        <input type="hidden" name={ATTENDEE_PLAN_FIELD} value={plan} />
        {importHref ? (
          <p className="text-xs text-gray-500">
            Bulk-importing a whole batch of events from a spreadsheet is a
            different job —{" "}
            <Link
              href={importHref}
              className="font-medium text-brand-blue-600 hover:underline"
            >
              import events from CSV
            </Link>
            .
          </p>
        ) : null}
      </fieldset>
    </Section>
  );

  /* --- Step 3: review, then create --------------------------------------- */
  const saveError = state?.error ?? null;

  const reviewSection = (
    <Section title="Review">
      <div className="space-y-5">
        <p className="text-sm text-gray-700">
          We ran a quick check on this event before saving. Review it below, then
          create it.
        </p>

        {/* Same list treatment as the attendee roster on the event itself
            (AttendeeManager) and as the `Card` primitive's own edge, so this
            reads as another surface rather than a one-off. The `dt` style is
            the shared `Label` component's, so each row is labelled exactly as
            its field was on step 1. */}
        {summary ? (
          <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {summary.map((r) => (
              <div
                key={r.label}
                className="grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-3 sm:gap-3"
              >
                <dt className="text-xs font-medium text-gray-700">{r.label}</dt>
                <dd
                  className={cn(
                    "text-sm sm:col-span-2",
                    r.empty
                      ? "text-gray-500"
                      : "whitespace-pre-wrap text-gray-900",
                  )}
                >
                  {r.value}
                </dd>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-3 sm:gap-3">
              <dt className="text-xs font-medium text-gray-700">Attendees</dt>
              <dd className="text-sm text-gray-900 sm:col-span-2">
                {plan === ATTENDEE_PLAN.UPLOAD
                  ? "None yet — you'll go straight to the attendee upload."
                  : "None yet — add them from the event whenever you're ready."}
              </dd>
            </div>
          </dl>
        ) : null}

        {previewPending ? (
          <p className="text-sm text-gray-500" role="status" aria-live="polite">
            Running the check…
          </p>
        ) : null}

        {/* The check itself failed — offer a retry. It is advisory, so the
            Create button stays enabled. */}
        {!previewPending && previewError ? (
          <div
            className="rounded-lg border border-warning-600 bg-warning-50 p-4"
            role="alert"
          >
            <p className="text-sm font-medium text-warning-600">
              {previewError}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              You can still create the event — the check is only advisory.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={runPreview}
              className="mt-2"
            >
              Try again
            </Button>
          </div>
        ) : null}

        {/* Save failure returned by the server action. */}
        {saveError ? (
          <div
            className="rounded-lg border border-danger-600 bg-danger-50 p-4"
            role="alert"
          >
            <p className="text-sm font-medium text-danger-600">{saveError}</p>
          </div>
        ) : null}

        {!previewPending && warnings ? (
          warnings.length > 0 ? (
            <div className="rounded-lg border border-warning-600 bg-warning-50 p-4">
              <h3 className="text-sm font-semibold text-warning-600">
                Worth a look
              </h3>
              <ul className="mt-2 space-y-2">
                {warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`} className="text-sm text-gray-900">
                    {w.message}
                    {w.event_id != null ? (
                      <>
                        {" "}
                        <Link
                          href={`/events?event=${w.event_id}`}
                          className="font-medium text-brand-blue-600 hover:underline"
                        >
                          View the existing event
                        </Link>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-gray-700">
                None of this stops you — create the event if it all looks right.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Nothing came up. This event looks new.
            </p>
          )
        ) : null}
      </div>
    </Section>
  );

  const errorBanner =
    state?.error || hasErrors ? (
      <p className="text-sm text-danger-600" role="alert">
        {state?.error ?? "Please fix the highlighted fields."}
      </p>
    ) : null;

  const stepSections = [detailsSection, attendeesSection, reviewSection];

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto w-full max-w-2xl"
    >
      {/* Progress */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Step {step + 1} of {EVENT_STEPS.length} · {EVENT_STEPS[step]}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-brand-blue-600 transition-all"
            style={{
              width: `${((step + 1) / EVENT_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* All steps stay mounted so the uncontrolled inputs keep their values
          for the final submit; only the current one is visible. */}
      {stepSections.map((section, i) => (
        <div key={EVENT_STEPS[i]} className={step === i ? "" : "hidden"}>
          {section}
        </div>
      ))}

      {/* The Review step surfaces its own findings, so suppress the generic
          banner there. */}
      {!onReview && errorBanner ? (
        <div className="mt-4">{errorBanner}</div>
      ) : null}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={goBack}>
            Back
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        )}
        {onReview ? (
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Creating…" : "Create event"}
          </Button>
        ) : step === EVENT_LAST_DATA_STEP ? (
          <Button type="button" variant="primary" onClick={goNext}>
            Review &amp; create
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={goNext}>
            Next
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * One choice in the Attendees step. A radio (the options are mutually
 * exclusive), rendered as a full-width tappable card so the whole block — not
 * just the 16px dot — is a 44px+ target on a phone.
 */
function PlanOption({
  value,
  checked,
  onSelect,
  title,
  description,
  badge,
  disabled = false,
}: {
  value: AttendeePlan;
  checked: boolean;
  onSelect: (v: AttendeePlan) => void;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        disabled && "cursor-not-allowed",
        checked
          ? "border-brand-blue-600 bg-brand-blue-50"
          : "border-gray-300 bg-white hover:bg-gray-50",
        disabled && !checked && "bg-gray-50 hover:bg-gray-50",
      )}
    >
      <input
        type="radio"
        name="attendee_plan_choice"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="mt-0.5 h-4 w-4 shrink-0 border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500 disabled:cursor-not-allowed"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-sm font-semibold",
              disabled ? "text-gray-500" : "text-gray-900",
            )}
          >
            {title}
          </span>
          {badge ? <Badge variant="tag">{badge}</Badge> : null}
        </span>
        <span className="mt-1 block text-sm text-gray-500">{description}</span>
      </span>
    </label>
  );
}
