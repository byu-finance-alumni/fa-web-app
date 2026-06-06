"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/(app)/events/actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Pre-fill values for the edit form. Dates must be `YYYY-MM-DD` for `<input type="date">`. */
export interface EventInitialValues {
  event_name?: string | null;
  event_type?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  event_notes?: string | null;
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-700">
        {label}
        {required ? <span className="text-danger-600"> *</span> : null}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 ${
          error
            ? "border-danger-600 focus:ring-danger-600"
            : "border-gray-300 focus:ring-brand-blue-500"
        }`}
        style={type === "date" ? { colorScheme: "light" } : undefined}
      />
      {error ? <p className="mt-1 text-xs text-danger-600">{error}</p> : null}
    </div>
  );
}

export function EventForm({
  action,
  submitLabel,
  cancelHref,
  initialValues,
}: {
  action: Action;
  submitLabel: string;
  cancelHref: string;
  initialValues?: EventInitialValues;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  const fe = state?.fieldErrors;
  const v = initialValues;

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-4 rounded-xl border border-gray-300 bg-white p-6 shadow-sm"
    >
      <Field
        label="Event name"
        name="event_name"
        required
        defaultValue={v?.event_name ?? undefined}
        error={fe?.event_name}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Type"
          name="event_type"
          defaultValue={v?.event_type ?? undefined}
          error={fe?.event_type}
        />
        <Field
          label="Date"
          name="event_date"
          type="date"
          defaultValue={v?.event_date ?? undefined}
          error={fe?.event_date}
        />
      </div>
      <Field
        label="Location"
        name="event_location"
        defaultValue={v?.event_location ?? undefined}
        error={fe?.event_location}
      />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-700">
          Notes
        </label>
        <textarea
          name="event_notes"
          rows={3}
          defaultValue={v?.event_notes ?? undefined}
          aria-invalid={fe?.event_notes ? true : undefined}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 ${
            fe?.event_notes
              ? "border-danger-600 focus:ring-danger-600"
              : "border-gray-300 focus:ring-brand-blue-500"
          }`}
        />
        {fe?.event_notes ? (
          <p className="mt-1 text-xs text-danger-600">{fe.event_notes}</p>
        ) : null}
      </div>

      {state?.error ? (
        <p className="text-sm text-danger-600">{state.error}</p>
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
