"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/(app)/alumni/actions";
import type { Alumni } from "@/types/alumni";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/* --------------------------------------------------------- validation ----- */

/**
 * Client-side mirror of the backend's semantic rules. The backend remains the
 * source of truth (it re-validates and returns per-field 422 details); this
 * exists for fast, inline feedback so users never have to round-trip to learn a
 * field is malformed.
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

/** Validate every field in a submitted FormData. Returns a name→message map. */
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

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  error,
  onBlur,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  error?: string;
  onBlur: (name: string, value: string) => void;
  required?: boolean;
}) {
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-xs font-medium text-gray-700"
      >
        {label}
        {required ? <span className="text-danger-600"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onBlur={(e) => onBlur(name, e.target.value)}
        className={`${BASE_INPUT} ${
          error
            ? "border-danger-600 focus:ring-danger-600"
            : "border-gray-300 focus:ring-brand-blue-500"
        }`}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- form ----- */

export function AlumniForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: Action;
  defaults?: Partial<Alumni>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  // Client-side field errors (blur + submit). Server 422 errors are merged in
  // via the `state.fieldErrors` map below.
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

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
      // Focus the first invalid field for keyboard/AT users.
      const first = VALIDATED_FIELDS.find((n) => found[n]);
      if (first) {
        const el = e.currentTarget.elements.namedItem(first);
        if (el instanceof HTMLElement) el.focus();
      }
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="max-w-2xl space-y-4 rounded-xl border border-gray-300 bg-white p-6 shadow-sm"
    >
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
        <label
          htmlFor="notes"
          className="mb-1.5 block text-xs font-medium text-gray-700"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={errors.notes ? "notes-error" : undefined}
          onBlur={(e) => handleBlur("notes", e.target.value)}
          className={`${BASE_INPUT} ${
            errors.notes
              ? "border-danger-600 focus:ring-danger-600"
              : "border-gray-300 focus:ring-brand-blue-500"
          }`}
        />
        {errors.notes ? (
          <p id="notes-error" className="mt-1 text-xs text-danger-600">
            {errors.notes}
          </p>
        ) : null}
      </div>

      {state?.error || hasErrors ? (
        <p className="text-sm text-danger-600" role="alert">
          {state?.error ?? "Please fix the highlighted fields."}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
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
