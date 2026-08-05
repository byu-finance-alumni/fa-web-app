"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EventFields,
  type EventFieldValues,
} from "@/components/events/EventFields";
import type { FormState } from "@/app/(app)/events/actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Pre-fill values for the edit form. Re-exported from {@link EventFields}. */
export type EventInitialValues = EventFieldValues;

/**
 * Edit an existing event.
 *
 * Shares its field block with the Add-event wizard ({@link EventFields}) and
 * renders it in the same titled section card the alumni forms use, so editing an
 * event and creating one look like one another and like the rest of the app.
 * Creating is a wizard (see EventWizard) because it has a decision to walk the
 * user through; editing is a single card because it does not.
 */
export function EventForm({
  action,
  submitLabel,
  cancelHref,
  initialValues,
  eventTypeOptions = [],
  cardClassName = "max-w-2xl",
}: {
  action: Action;
  submitLabel: string;
  cancelHref: string;
  initialValues?: EventInitialValues;
  /** Managed event-type options (from the editable vocabulary). Admins curate
   * these under Admin → Vocabulary. */
  eventTypeOptions?: string[];
  /** Width class for the form Card. Defaults to `max-w-2xl` (standalone create
   * page); the edit page passes `w-full` to fill its grid column. */
  cardClassName?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  return (
    <Card className={cardClassName}>
      <CardHeader>
        <CardTitle>Event details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <EventFields
            values={initialValues}
            errors={state?.fieldErrors ?? {}}
            eventTypeOptions={eventTypeOptions}
          />

          {state?.error ? (
            <p className="text-sm text-danger-600" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
            <Button asChild variant="secondary">
              <Link href={cancelHref}>Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
