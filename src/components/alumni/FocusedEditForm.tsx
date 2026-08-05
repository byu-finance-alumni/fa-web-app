"use client";

import Link from "next/link";
import { Section } from "@/components/alumni/form-fields";
import { Button } from "@/components/ui/button";

/**
 * Shared layout for a focused single-section edit form
 * (`/alumni/[id]/edit/*`). Renders the "← Back to all sections" link, the
 * titled card, a form-level error banner, and the Save / Cancel controls.
 *
 * This is a PURE layout shell — it does not own the form state. Each section
 * component owns its own `useActionState` (so it can also hold local UI state
 * like a revealed "Specify" input) and passes the resulting `formAction`,
 * `pending`, and `error` down. The actual inputs are the `children`.
 */
export function FocusedEditForm({
  title,
  note,
  formAction,
  pending,
  error,
  cancelHref,
  pickerHref,
  submitLabel = "Save",
  onSubmit,
  children,
}: {
  title: string;
  /** Optional muted helper line shown above the fields. */
  note?: string;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  /** Where Cancel goes — the profile. */
  cancelHref: string;
  /** Where the back link goes — the section picker. */
  pickerHref: string;
  submitLabel?: string;
  /**
   * Optional pre-submit client validation (#626). Calling `preventDefault()`
   * inside it stops React from running `formAction`, so a section that has
   * inline rules can block the round-trip — the same `action` + `onSubmit`
   * arrangement `AlumniForm` uses. Sections without client rules simply omit it
   * and behave exactly as before.
   *
   * Deliberately NOT paired with `noValidate`: these forms have `type="email"`
   * inputs whose native check is existing behaviour, and the name rules below
   * don't rely on suppressing it (no name input carries an HTML constraint).
   */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-2xl space-y-4"
    >
      <div>
        <Link
          href={pickerHref}
          className="text-sm font-medium text-brand-blue-600 hover:underline"
        >
          ← Back to all sections
        </Link>
      </div>

      <Section title={title}>
        <div className="space-y-4">
          {note ? <p className="text-sm text-gray-700">{note}</p> : null}
          {children}
        </div>
      </Section>

      {error ? (
        <p className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      ) : null}

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
