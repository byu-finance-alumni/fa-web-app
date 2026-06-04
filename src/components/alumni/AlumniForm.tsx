"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/(app)/alumni/actions";
import type { Alumni } from "@/types/alumni";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-700">
        {label}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
      />
    </div>
  );
}

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

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-4 rounded-xl border border-gray-300 bg-white p-6"
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" name="first_name" defaultValue={defaults?.first_name ?? ""} />
        <Field label="Last name" name="last_name" defaultValue={defaults?.last_name ?? ""} />
      </div>
      <Field
        label="Preferred name"
        name="preferred_first_name"
        defaultValue={defaults?.preferred_first_name ?? ""}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field label="BYU ID" name="byu_id" defaultValue={defaults?.byu_id ?? ""} />
        <Field label="Net ID" name="net_id" defaultValue={defaults?.net_id ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Graduation year"
          name="graduation_year"
          type="number"
          defaultValue={defaults?.graduation_year?.toString() ?? ""}
        />
        <Field label="Gender" name="gender" defaultValue={defaults?.gender ?? ""} />
      </div>
      <Field
        label="LinkedIn URL"
        name="linkedin_url"
        defaultValue={defaults?.linkedin_url ?? ""}
      />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-700">
          Notes
        </label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
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
