"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { FormState, PreviewState } from "@/app/(app)/alumni/actions";
import type { Alumni, HygienePreview } from "@/types/alumni";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import { SpousePicker } from "@/components/alumni/SpousePicker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Runs the server-side hygiene preview for the current form's FormData. The
 * Add page binds {@link previewAlumni}; the Edit page binds
 * {@link previewAlumniUpdate} with the alumni id already applied. */
type PreviewAction = (formData: FormData) => Promise<PreviewState>;

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
  /** Linked spouse's current display name (from the profile aggregate), used to
   * label the "Linked" chip when editing. */
  spouseAlumniName?: string | null;
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

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="mb-1.5">
      {children}
      {required ? <span className="text-danger-600"> *</span> : null}
    </Label>
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
      <FieldLabel htmlFor={name} required={required}>
        {label}
      </FieldLabel>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        // Off so the browser can't inject/duplicate autofill text into these
        // uncontrolled fields (the only path that could render e.g. a doubled
        // "FinanceFinance" department value; the stored data is single).
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onBlur={onBlur ? (e) => onBlur(name, e.target.value) : undefined}
        className={cn(
          error && "border-danger-600 focus-visible:ring-danger-600",
        )}
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
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          error && "border-danger-600 focus-visible:ring-danger-600",
        )}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </Select>
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* -------------------------------------------------------- review helpers --- */

/** Render a hygiene before/after value for display, showing "(empty)" for
 * null/blank and stringifying scalars/booleans plainly. */
function displayValue(v: unknown): string {
  if (v === null || v === undefined) return "(empty)";
  if (typeof v === "string") return v.trim() === "" ? "(empty)" : v;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/* ---------------------------------------------------------------- form ----- */

const STEPS = [
  "Core",
  "Contact",
  "Current career",
  "Education",
  "Secondary affiliations",
  "Engagement",
  "Review",
];
/** Index of the final Review step (data-hygiene preview). */
const REVIEW_STEP = STEPS.length - 1;
/** Index of the last data-entry step before Review. */
const LAST_DATA_STEP = REVIEW_STEP - 1;

export function AlumniForm({
  action,
  previewAction,
  defaults,
  submitLabel,
  cancelHref,
  extended = false,
}: {
  action: Action;
  /** Server action that runs the data-hygiene preview for the Review step.
   * Required when `extended` (the wizard); ignored otherwise. */
  previewAction?: PreviewAction;
  defaults?: AlumniFormDefaults;
  submitLabel: string;
  cancelHref: string;
  /** When true, render the optional extended sections as a centered multi-step
   * wizard ending in a data-hygiene Review step. When false, render a single
   * core-only form (no wizard, no Review). */
  extended?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  // Client-side field errors (blur + submit). Server 422 errors are merged in
  // via the `state.fieldErrors` map below.
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Wizard state (extended only). Every step stays mounted (hidden when not
  // current) so uncontrolled inputs keep their values for the final submit.
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Review-step (data-hygiene preview) state. `preview` holds the last
  // successful server result; `previewError` is a message to retry on; the
  // transition tracks the in-flight preview call.
  const [preview, setPreview] = useState<HygienePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPending, startPreview] = useTransition();

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

  // Run the server-side hygiene preview against the current form's FormData.
  // Used when entering the Review step (and on retry). Captures the snapshot at
  // call time so the preview reflects exactly what's in the form now.
  const runPreview = () => {
    if (!previewAction || !formRef.current) return;
    const formData = new FormData(formRef.current);
    setPreviewError(null);
    startPreview(async () => {
      const result = await previewAction(formData);
      if (result.ok) {
        setPreview(result.preview);
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(result.error);
      }
    });
  };

  // Advance the wizard, gating the required Core step before leaving it. When
  // advancing onto the Review step, kick off the hygiene preview.
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
    const next = Math.min(step + 1, REVIEW_STEP);
    if (next === REVIEW_STEP) runPreview();
    setStep(next);
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const hasErrors = Object.keys(errors).length > 0;
  // Save is gated while the preview reports any blocker (exact duplicate
  // byu_id/net_id). Until a successful preview exists, Save is also disabled.
  const blockers = preview?.blockers ?? [];
  const saveBlocked = !preview || blockers.length > 0 || previewPending;

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
          label="Birthday"
          name="birth_date"
          type="date"
          defaultValue={defaults?.birth_date ?? ""}
          error={errors.birth_date}
        />
        <Field
          label="LinkedIn URL"
          name="linkedin_url"
          defaultValue={defaults?.linkedin_url ?? ""}
          error={errors.linkedin_url}
          onBlur={handleBlur}
        />
        <div>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={defaults?.notes ?? ""}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={errors.notes ? "notes-error" : undefined}
            onBlur={(e) => handleBlur("notes", e.target.value)}
            className={cn(
              errors.notes && "border-danger-600 focus-visible:ring-danger-600",
            )}
          />
          {errors.notes ? (
            <p id="notes-error" className="mt-1 text-xs text-danger-600">
              {errors.notes}
            </p>
          ) : null}
        </div>
        <SpousePicker
          selfId={defaults?.alumni_id}
          errors={errors}
          defaults={{
            spouse_first_name: defaults?.spouse_first_name,
            spouse_last_name: defaults?.spouse_last_name,
            spouse_birth_date: defaults?.spouse_birth_date,
            spouse_alumni_id: defaults?.spouse_alumni_id,
            spouse_alumni_name: defaults?.spouseAlumniName,
          }}
        />
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

        {/* Additional schooling / programs — top-level alumni fields (siblings
            of graduate_degree), so they're named plainly and flow through the
            core payload, not the nested `education` section. */}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Graduate degree"
            name="graduate_degree"
            defaultValue={defaults?.graduate_degree ?? ""}
            error={errors.graduate_degree}
          />
          <Field
            label="MBA program"
            name="mba_program"
            defaultValue={defaults?.mba_program ?? ""}
            error={errors.mba_program}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Law school"
            name="law_school"
            defaultValue={defaults?.law_school ?? ""}
            error={errors.law_school}
          />
          <Field
            label="Medical school"
            name="medical_school"
            defaultValue={defaults?.medical_school ?? ""}
            error={errors.medical_school}
          />
        </div>
        <Field
          label="Graduate school"
          name="graduate_school"
          defaultValue={defaults?.graduate_school ?? ""}
          error={errors.graduate_school}
        />
      </div>
    </Section>
  );

  const secondaryAffiliationsSection = (
    <Section title="Secondary affiliations">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          Optional narrative context — entrepreneurial ventures, board or
          advisory positions, and any employment beyond the current role.
        </p>
        <div>
          <FieldLabel htmlFor="startup_involvement">
            Startup involvement
          </FieldLabel>
          <Textarea
            id="startup_involvement"
            name="startup_involvement"
            rows={3}
            defaultValue={defaults?.startup_involvement ?? ""}
            aria-invalid={errors.startup_involvement ? true : undefined}
            aria-describedby={
              errors.startup_involvement ? "startup_involvement-error" : undefined
            }
            className={cn(
              errors.startup_involvement &&
                "border-danger-600 focus-visible:ring-danger-600",
            )}
          />
          {errors.startup_involvement ? (
            <p
              id="startup_involvement-error"
              className="mt-1 text-xs text-danger-600"
            >
              {errors.startup_involvement}
            </p>
          ) : null}
        </div>
        <div>
          <FieldLabel htmlFor="advisory_roles">Advisory roles</FieldLabel>
          <Textarea
            id="advisory_roles"
            name="advisory_roles"
            rows={3}
            defaultValue={defaults?.advisory_roles ?? ""}
            aria-invalid={errors.advisory_roles ? true : undefined}
            aria-describedby={
              errors.advisory_roles ? "advisory_roles-error" : undefined
            }
            className={cn(
              errors.advisory_roles &&
                "border-danger-600 focus-visible:ring-danger-600",
            )}
          />
          {errors.advisory_roles ? (
            <p id="advisory_roles-error" className="mt-1 text-xs text-danger-600">
              {errors.advisory_roles}
            </p>
          ) : null}
        </div>
        <div>
          <FieldLabel htmlFor="secondary_employment">
            Secondary employment
          </FieldLabel>
          <Textarea
            id="secondary_employment"
            name="secondary_employment"
            rows={3}
            defaultValue={defaults?.secondary_employment ?? ""}
            aria-invalid={errors.secondary_employment ? true : undefined}
            aria-describedby={
              errors.secondary_employment
                ? "secondary_employment-error"
                : undefined
            }
            className={cn(
              errors.secondary_employment &&
                "border-danger-600 focus-visible:ring-danger-600",
            )}
          />
          {errors.secondary_employment ? (
            <p
              id="secondary_employment-error"
              className="mt-1 text-xs text-danger-600"
            >
              {errors.secondary_employment}
            </p>
          ) : null}
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
          <FieldLabel htmlFor="engagement.engagement_notes">
            Engagement notes
          </FieldLabel>
          <Textarea
            id="engagement.engagement_notes"
            name="engagement.engagement_notes"
            rows={3}
            defaultValue={defaults?.engagement?.engagement_notes ?? ""}
            className={cn(
              errors["engagement.engagement_notes"] &&
                "border-danger-600 focus-visible:ring-danger-600",
            )}
          />
        </div>
      </div>
    </Section>
  );

  // A submit only fires from the Review step, so any post-submit `state.error`
  // (e.g. a 409 race where a duplicate appeared between preview and save) is a
  // save failure surfaced here as a blocker-style alert.
  const saveError = state?.error ?? null;

  const reviewSection = (
    <Section title="Review">
      <div className="space-y-5">
        <p className="text-sm text-gray-700">
          We ran a quick check on this record before saving. Review the findings
          below, then save.
        </p>

        {/* Loading */}
        {previewPending ? (
          <p
            className="text-sm text-gray-500"
            role="status"
            aria-live="polite"
          >
            Running the check…
          </p>
        ) : null}

        {/* Preview call failed — offer a retry. */}
        {!previewPending && previewError ? (
          <div
            className="rounded-lg border border-danger-600 bg-danger-50 p-4"
            role="alert"
          >
            <p className="text-sm font-medium text-danger-600">
              {previewError}
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

        {/* Save failure (e.g. 409 race) — blocker-style. */}
        {saveError ? (
          <div
            className="rounded-lg border border-danger-600 bg-danger-50 p-4"
            role="alert"
          >
            <p className="text-sm font-medium text-danger-600">{saveError}</p>
          </div>
        ) : null}

        {/* Findings (only once a preview succeeded). */}
        {!previewPending && preview ? (
          <div className="space-y-5">
            {/* Blockers — must fix; disable Save. */}
            {blockers.length > 0 ? (
              <div className="rounded-lg border border-danger-600 bg-danger-50 p-4">
                <h3 className="text-sm font-semibold text-danger-600">
                  Must fix before saving
                </h3>
                <ul className="mt-2 space-y-2">
                  {blockers.map((b, i) => (
                    <li key={`${b.code}-${i}`} className="text-sm text-gray-900">
                      {b.message}
                      {b.alumni_id != null ? (
                        <>
                          {" "}
                          <Link
                            href={`/alumni/${b.alumni_id}`}
                            className="font-medium text-brand-blue-600 hover:underline"
                          >
                            View existing record
                          </Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Auto-clean diff. */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                We tidied these
              </h3>
              {preview.changes.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {preview.changes.map((c, i) => (
                    <li
                      key={`${c.section}-${c.field}-${i}`}
                      className="text-sm text-gray-700"
                    >
                      <span className="font-medium text-gray-900">
                        {c.label}:
                      </span>{" "}
                      <span className="text-gray-500 line-through">
                        {displayValue(c.before)}
                      </span>{" "}
                      <span aria-hidden="true">→</span>{" "}
                      <span className="text-gray-900">
                        {displayValue(c.after)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  Nothing needed cleaning.
                </p>
              )}
            </div>

            {/* Warnings — advisory; do not disable Save. */}
            {preview.warnings.length > 0 ? (
              <div className="rounded-lg border border-warning-600 bg-warning-50 p-4">
                <h3 className="text-sm font-semibold text-warning-600">
                  Worth a look
                </h3>
                <ul className="mt-2 space-y-2">
                  {preview.warnings.map((w, i) => (
                    <li key={`${w.code}-${i}`} className="text-sm text-gray-900">
                      {w.message}
                      {w.alumni_id != null ? (
                        <>
                          {" "}
                          <Link
                            href={`/alumni/${w.alumni_id}`}
                            className="font-medium text-brand-blue-600 hover:underline"
                          >
                            View possible duplicate
                          </Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
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
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          <Button asChild variant="secondary">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        </div>
      </form>
    );
  }

  /* --- Extended layout: centered step-by-step wizard + Review ------------ */
  const stepSections = [
    coreSection,
    contactSection,
    careerSection,
    educationSection,
    secondaryAffiliationsSection,
    engagementSection,
    reviewSection,
  ];
  const onReview = step === REVIEW_STEP;

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

      {/* Field-error banner shows on data steps; the Review step surfaces its
          own preview/save findings, so suppress the generic banner there. */}
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
          // Final step: run the EXISTING create/update submit. Disabled while a
          // blocker exists (or the preview is still running/absent).
          <Button
            type="submit"
            variant="primary"
            disabled={pending || saveBlocked}
            title={
              blockers.length > 0
                ? "Resolve the blocking issue above before saving."
                : undefined
            }
          >
            {pending ? "Saving…" : submitLabel}
          </Button>
        ) : step === LAST_DATA_STEP ? (
          <Button type="button" variant="primary" onClick={goNext}>
            Review &amp; save
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
