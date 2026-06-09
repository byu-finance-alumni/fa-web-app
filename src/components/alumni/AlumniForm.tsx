"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/(app)/alumni/actions";
import type { Alumni } from "@/types/alumni";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Default values for the form. Core fields come from {@link Alumni}; the
 * extended wizard sections carry their own (string) values so the edit page can
 * prefill them. Each section is optional — when absent (Add page) every
 * extended field renders blank, exactly as before.
 *
 * Section values are kept as strings to feed `defaultValue` directly (numbers
 * like `degree_year` are stringified by the caller); engagement flags are
 * booleans for `defaultChecked`.
 */
export type AlumniFormDefaults = Partial<Alumni> & {
  contact?: Record<string, string>;
  career?: Record<string, string>;
  education?: Record<string, string>;
  engagement?: {
    flags?: Record<string, boolean>;
    engagement_notes?: string;
  };
};

/* --------------------------------------------------------- validation ----- */

/**
 * Client-side mirror of the backend's semantic rules. The backend remains the
 * source of truth (it re-validates and returns per-field 422 details); this
 * exists for fast, inline feedback so users never have to round-trip to learn a
 * field is malformed.
 *
 * Only the CORE fields are validated here — the extended sections are entirely
 * optional and free-text (industry is constrained by a <select>), so they rely
 * on the backend's server-side validation.
 */

// Names: letters, spaces, apostrophes, hyphens, periods (allow accented letters).
const NAME_RE = /^[\p{L} '.-]+$/u;
// Net ID: lowercase alphanumeric.
const NET_ID_RE = /^[a-z0-9]+$/;
// BYU ID: exactly 9 digits.
const BYU_ID_RE = /^\d{9}$/;

const MAX_LEN = {
  first_name: 100,
  last_name: 100,
  preferred_first_name: 100,
  net_id: 50,
  gender: 50,
  linkedin_url: 500,
  notes: 10000, // matches the backend cap (_NOTES_MAX)
} as const;

const MIN_GRAD_YEAR = 1950;
const MAX_GRAD_YEAR = new Date().getFullYear() + 10;

/** Validate a single field's raw string value. Returns a message or null. */
function validateField(name: string, raw: string): string | null {
  const v = raw.trim();

  switch (name) {
    case "first_name":
    case "last_name":
      if (v === "") return "Required.";
      if (v.length > MAX_LEN[name]) return `Must be ${MAX_LEN[name]} characters or fewer.`;
      if (!NAME_RE.test(v))
        return "Only letters, spaces, apostrophes, hyphens, and periods.";
      return null;

    case "preferred_first_name":
      if (v === "") return null;
      if (v.length > MAX_LEN.preferred_first_name)
        return `Must be ${MAX_LEN.preferred_first_name} characters or fewer.`;
      if (!NAME_RE.test(v))
        return "Only letters, spaces, apostrophes, hyphens, and periods.";
      return null;

    case "byu_id":
      if (v === "") return null;
      if (!BYU_ID_RE.test(v)) return "Must be exactly 9 digits.";
      return null;

    case "net_id":
      if (v === "") return null;
      if (v.length > MAX_LEN.net_id)
        return `Must be ${MAX_LEN.net_id} characters or fewer.`;
      if (!NET_ID_RE.test(v))
        return "Lowercase letters and numbers only.";
      return null;

    case "graduation_year": {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n))
        return "Enter a valid year.";
      if (n < MIN_GRAD_YEAR || n > MAX_GRAD_YEAR)
        return `Must be between ${MIN_GRAD_YEAR} and ${MAX_GRAD_YEAR}.`;
      return null;
    }

    case "gender":
      if (v === "") return null;
      if (v.length > MAX_LEN.gender)
        return `Must be ${MAX_LEN.gender} characters or fewer.`;
      return null;

    case "linkedin_url": {
      if (v === "") return null;
      if (v.length > MAX_LEN.linkedin_url)
        return `Must be ${MAX_LEN.linkedin_url} characters or fewer.`;
      let host: string;
      try {
        host = new URL(v).hostname.toLowerCase();
      } catch {
        return "Enter a full URL, e.g. https://www.linkedin.com/in/you.";
      }
      if (host !== "linkedin.com" && !host.endsWith(".linkedin.com"))
        return "Must be a linkedin.com URL.";
      return null;
    }

    case "notes":
      if (v.length > MAX_LEN.notes)
        return `Must be ${MAX_LEN.notes} characters or fewer.`;
      return null;

    default:
      return null;
  }
}

const VALIDATED_FIELDS = [
  "first_name",
  "last_name",
  "preferred_first_name",
  "byu_id",
  "net_id",
  "graduation_year",
  "gender",
  "linkedin_url",
  "notes",
] as const;

/** Validate every core field in a submitted FormData. Returns a name→message map. */
function validateAll(formData: FormData): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const name of VALIDATED_FIELDS) {
    const raw = formData.get(name);
    const msg = validateField(name, typeof raw === "string" ? raw : "");
    if (msg) errors[name] = msg;
  }
  return errors;
}

/* --------------------------------------------------------------- field ----- */

const BASE_INPUT =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2";

function inputClasses(hasError: boolean): string {
  return `${BASE_INPUT} ${
    hasError
      ? "border-danger-600 focus:ring-danger-600"
      : "border-gray-300 focus:ring-brand-blue-500"
  }`;
}

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium text-gray-700"
    >
      {children}
      {required ? <span className="text-danger-600"> *</span> : null}
    </label>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  error,
  onBlur,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  error?: string;
  onBlur?: (name: string, value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div>
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onBlur={onBlur ? (e) => onBlur(name, e.target.value) : undefined}
        className={inputClasses(!!error)}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  error,
  defaultValue = "",
}: {
  label: string;
  name: string;
  options: readonly string[];
  error?: string;
  defaultValue?: string;
}) {
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={inputClasses(!!error)}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Checkbox({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
      />
      {label}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- form ----- */

const STEPS = ["Core", "Contact", "Current career", "Education", "Engagement"];

export function AlumniForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  extended = false,
}: {
  action: Action;
  defaults?: AlumniFormDefaults;
  submitLabel: string;
  cancelHref: string;
  /** When true (Add page only), render the optional extended sections as a
   * centered multi-step wizard. The edit page leaves this false so it stays a
   * single core-only form. */
  extended?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  // Client-side field errors (blur + submit). Server 422 errors are merged in
  // via the `state.fieldErrors` map below.
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Wizard state (extended/Add only). Every step stays mounted (hidden when not
  // current) so uncontrolled inputs keep their values for the final submit.
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const lastStep = STEPS.length - 1;

  // Merge: client-side errors take precedence (freshest input), then any
  // server-returned field errors for fields the client hasn't re-touched.
  const errors: Record<string, string> = {
    ...(state?.fieldErrors ?? {}),
    ...clientErrors,
  };

  const handleBlur = (name: string, value: string) => {
    const msg = validateField(name, value);
    setClientErrors((prev) => {
      const next = { ...prev };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    const found = validateAll(formData);
    if (Object.keys(found).length > 0) {
      e.preventDefault();
      setClientErrors(found);
      // All validated fields live on the Core step — jump back to it so the
      // errors are visible in the wizard.
      setStep(0);
      const first = VALIDATED_FIELDS.find((n) => found[n]);
      if (first) {
        const el = e.currentTarget.elements.namedItem(first);
        if (el instanceof HTMLElement) el.focus();
      }
    }
  };

  // Advance the wizard, gating the required Core step before leaving it.
  const goNext = () => {
    if (step === 0 && formRef.current) {
      const found = validateAll(new FormData(formRef.current));
      if (Object.keys(found).length > 0) {
        setClientErrors(found);
        const first = VALIDATED_FIELDS.find((n) => found[n]);
        const el = first ? formRef.current.elements.namedItem(first) : null;
        if (el instanceof HTMLElement) el.focus();
        return;
      }
    }
    setStep((s) => Math.min(s + 1, lastStep));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const hasErrors = Object.keys(errors).length > 0;

  // Prefill accessors for the extended sections. Each returns "" / false when
  // the section (or field) is absent, so the Add page renders blank inputs.
  const contact = (name: string) => defaults?.contact?.[name] ?? "";
  const career = (name: string) => defaults?.career?.[name] ?? "";
  const education = (name: string) => defaults?.education?.[name] ?? "";
  const flag = (name: string) =>
    defaults?.engagement?.flags?.[name] ?? false;

  /* --- Core section (shared by add + edit) ------------------------------- */
  const coreSection = (
    <Section title="Core">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="First name"
            name="first_name"
            required
            defaultValue={defaults?.first_name ?? ""}
            error={errors.first_name}
            onBlur={handleBlur}
          />
          <Field
            label="Last name"
            name="last_name"
            required
            defaultValue={defaults?.last_name ?? ""}
            error={errors.last_name}
            onBlur={handleBlur}
          />
        </div>
        <Field
          label="Preferred name"
          name="preferred_first_name"
          defaultValue={defaults?.preferred_first_name ?? ""}
          error={errors.preferred_first_name}
          onBlur={handleBlur}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="BYU ID"
            name="byu_id"
            defaultValue={defaults?.byu_id ?? ""}
            error={errors.byu_id}
            onBlur={handleBlur}
          />
          <Field
            label="Net ID"
            name="net_id"
            defaultValue={defaults?.net_id ?? ""}
            error={errors.net_id}
            onBlur={handleBlur}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Graduation year"
            name="graduation_year"
            type="number"
            defaultValue={defaults?.graduation_year?.toString() ?? ""}
            error={errors.graduation_year}
            onBlur={handleBlur}
          />
          <Field
            label="Gender"
            name="gender"
            defaultValue={defaults?.gender ?? ""}
            error={errors.gender}
            onBlur={handleBlur}
          />
        </div>
        <Field
          label="LinkedIn URL"
          name="linkedin_url"
          defaultValue={defaults?.linkedin_url ?? ""}
          error={errors.linkedin_url}
          onBlur={handleBlur}
        />
        <div>
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={defaults?.notes ?? ""}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={errors.notes ? "notes-error" : undefined}
            onBlur={(e) => handleBlur("notes", e.target.value)}
            className={inputClasses(!!errors.notes)}
          />
          {errors.notes ? (
            <p id="notes-error" className="mt-1 text-xs text-danger-600">
              {errors.notes}
            </p>
          ) : null}
        </div>
      </div>
    </Section>
  );

  const contactSection = (
    <Section title="Contact">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Personal email"
            name="contact.personal_email"
            type="email"
            defaultValue={contact("personal_email")}
            error={errors["contact.personal_email"]}
          />
          <Field
            label="Work email"
            name="contact.work_email"
            type="email"
            defaultValue={contact("work_email")}
            error={errors["contact.work_email"]}
          />
        </div>
        <Field
          label="Phone"
          name="contact.phone"
          defaultValue={contact("phone")}
          error={errors["contact.phone"]}
        />
        <Field
          label="Address line 1"
          name="contact.address_line_1"
          defaultValue={contact("address_line_1")}
          error={errors["contact.address_line_1"]}
        />
        <Field
          label="Address line 2"
          name="contact.address_line_2"
          defaultValue={contact("address_line_2")}
          error={errors["contact.address_line_2"]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="City"
            name="contact.city"
            defaultValue={contact("city")}
            error={errors["contact.city"]}
          />
          <Field
            label="State"
            name="contact.state"
            defaultValue={contact("state")}
            error={errors["contact.state"]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="ZIP"
            name="contact.zip"
            defaultValue={contact("zip")}
            error={errors["contact.zip"]}
          />
          <Field
            label="Country"
            name="contact.country"
            defaultValue={contact("country")}
            error={errors["contact.country"]}
          />
        </div>
        <Field
          label="Region"
          name="contact.region"
          defaultValue={contact("region")}
          error={errors["contact.region"]}
        />
      </div>
    </Section>
  );

  const careerSection = (
    <Section title="Current career">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Employer"
            name="career.current_employer"
            defaultValue={career("current_employer")}
            error={errors["career.current_employer"]}
          />
          <Field
            label="Title"
            name="career.current_title"
            defaultValue={career("current_title")}
            error={errors["career.current_title"]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Industry"
            name="career.current_industry"
            options={INDUSTRY_OPTIONS}
            defaultValue={career("current_industry")}
            error={errors["career.current_industry"]}
          />
          <SelectField
            label="Secondary industry"
            name="career.current_industry_secondary"
            options={INDUSTRY_OPTIONS}
            defaultValue={career("current_industry_secondary")}
            error={errors["career.current_industry_secondary"]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="City"
            name="career.current_city"
            defaultValue={career("current_city")}
            error={errors["career.current_city"]}
          />
          <Field
            label="State"
            name="career.current_state"
            defaultValue={career("current_state")}
            error={errors["career.current_state"]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Country"
            name="career.current_country"
            defaultValue={career("current_country")}
            error={errors["career.current_country"]}
          />
          <Field
            label="ZIP"
            name="career.current_zip"
            defaultValue={career("current_zip")}
            error={errors["career.current_zip"]}
          />
        </div>
        <Field
          label="Seniority level"
          name="career.seniority_level"
          defaultValue={career("seniority_level")}
          error={errors["career.seniority_level"]}
        />
      </div>
    </Section>
  );

  const educationSection = (
    <Section title="Education">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="University"
            name="education.university"
            defaultValue={education("university")}
            error={errors["education.university"]}
          />
          <Field
            label="College"
            name="education.college"
            defaultValue={education("college")}
            error={errors["education.college"]}
          />
        </div>
        <Field
          label="Department"
          name="education.department"
          defaultValue={education("department")}
          error={errors["education.department"]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Degree"
            name="education.degree"
            defaultValue={education("degree")}
            error={errors["education.degree"]}
          />
          <Field
            label="Major"
            name="education.major"
            defaultValue={education("major")}
            error={errors["education.major"]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Degree status"
            name="education.degree_status"
            defaultValue={education("degree_status")}
            error={errors["education.degree_status"]}
          />
          <Field
            label="Degree year"
            name="education.degree_year"
            type="number"
            defaultValue={education("degree_year")}
            error={errors["education.degree_year"]}
          />
        </div>
      </div>
    </Section>
  );

  const engagementSection = (
    <Section title="Engagement">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Checkbox
            label="Willing to host NetTrek"
            name="engagement.nettrek_host_willing"
            defaultChecked={flag("nettrek_host_willing")}
          />
          <Checkbox
            label="Willing to attend finance conference"
            name="engagement.finance_conference_willing"
            defaultChecked={flag("finance_conference_willing")}
          />
          <Checkbox
            label="Willing to mentor"
            name="engagement.mentor_willing"
            defaultChecked={flag("mentor_willing")}
          />
          <Checkbox
            label="Willing to sponsor company event"
            name="engagement.company_event_sponsor_willing"
            defaultChecked={flag("company_event_sponsor_willing")}
          />
          <Checkbox
            label="Willing to guest speak"
            name="engagement.guest_speaker_willing"
            defaultChecked={flag("guest_speaker_willing")}
          />
          <Checkbox
            label="Willing to help at events"
            name="engagement.help_at_event_willing"
            defaultChecked={flag("help_at_event_willing")}
          />
          <Checkbox
            label="Willing to host case competition"
            name="engagement.case_competition_host_willing"
            defaultChecked={flag("case_competition_host_willing")}
          />
          <Checkbox
            label="Willing to mentor (Women in Finance)"
            name="engagement.women_in_finance_mentor_willing"
            defaultChecked={flag("women_in_finance_mentor_willing")}
          />
          <Checkbox
            label="Hired a finance intern"
            name="engagement.hired_finance_intern"
            defaultChecked={flag("hired_finance_intern")}
          />
          <Checkbox
            label="Hired finance full-time"
            name="engagement.hired_finance_full_time"
            defaultChecked={flag("hired_finance_full_time")}
          />
          <Checkbox
            label="CFP designation"
            name="engagement.cfp_designation"
            defaultChecked={flag("cfp_designation")}
          />
          <Checkbox
            label="CFA designation"
            name="engagement.cfa_designation"
            defaultChecked={flag("cfa_designation")}
          />
          <Checkbox
            label="PIFF donor"
            name="engagement.piff_donor"
            defaultChecked={flag("piff_donor")}
          />
        </div>
        <div>
          <Label htmlFor="engagement.engagement_notes">Engagement notes</Label>
          <textarea
            id="engagement.engagement_notes"
            name="engagement.engagement_notes"
            rows={3}
            defaultValue={defaults?.engagement?.engagement_notes ?? ""}
            className={inputClasses(!!errors["engagement.engagement_notes"])}
          />
        </div>
      </div>
    </Section>
  );

  const errorBanner =
    state?.error || hasErrors ? (
      <p className="text-sm text-danger-600" role="alert">
        {state?.error ?? "Please fix the highlighted fields."}
      </p>
    ) : null;

  /* --- Core-only layout (edit page) -------------------------------------- */
  if (!extended) {
    return (
      <form
        action={formAction}
        onSubmit={handleSubmit}
        noValidate
        className="max-w-2xl space-y-4"
      >
        {coreSection}
        {errorBanner}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-60"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
          <Link
            href={cancelHref}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    );
  }

  /* --- Extended layout (Add page): centered step-by-step wizard ---------- */
  const stepSections = [
    coreSection,
    contactSection,
    careerSection,
    educationSection,
    engagementSection,
  ];

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
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-brand-blue-600 transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* All steps stay mounted; only the current one is visible. */}
      {stepSections.map((section, i) => (
        <div key={STEPS[i]} className={step === i ? "" : "hidden"}>
          {section}
        </div>
      ))}

      {errorBanner ? <div className="mt-4">{errorBanner}</div> : null}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        ) : (
          <Link
            href={cancelHref}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        )}
        {step < lastStep ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-brand-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-500"
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-60"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
