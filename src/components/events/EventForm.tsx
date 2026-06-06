"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/(app)/events/actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
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
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
        style={type === "date" ? { colorScheme: "light" } : undefined}
      />
    </div>
  );
}

export function EventForm({
  action,
  submitLabel,
  cancelHref,
}: {
  action: Action;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-4 rounded-xl border border-gray-300 bg-white p-6 shadow-sm"
    >
      <Field label="Event name" name="event_name" required />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type" name="event_type" />
        <Field label="Date" name="event_date" type="date" />
      </div>
      <Field label="Location" name="event_location" />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-700">
          Notes
        </label>
        <textarea
          name="event_notes"
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
        />
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
