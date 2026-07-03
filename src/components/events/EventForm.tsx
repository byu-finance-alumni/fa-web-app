"use client";

import { useActionState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
      <Label htmlFor={name} className="mb-1.5">
        {label}
        {required ? <span className="text-danger-600"> *</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className={cn(
          error &&
            "border-danger-600 focus-visible:border-danger-600 focus-visible:ring-danger-600",
        )}
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
  eventTypeOptions = [],
}: {
  action: Action;
  submitLabel: string;
  cancelHref: string;
  initialValues?: EventInitialValues;
  /** Managed event-type options (from the editable vocabulary). Admins curate
   * these under Admin → Vocabulary. */
  eventTypeOptions?: string[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  const fe = state?.fieldErrors;
  const v = initialValues;

  // Preserve a legacy/unlisted type on the record so editing never silently
  // drops it: surface it as an extra option even if it's no longer in the set.
  const current = v?.event_type ?? "";
  const hasCurrent = eventTypeOptions.some(
    (o) => o.toLowerCase() === current.toLowerCase(),
  );
  const typeOptions =
    current && !hasCurrent ? [current, ...eventTypeOptions] : eventTypeOptions;

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <Field
            label="Event name"
            name="event_name"
            required
            defaultValue={v?.event_name ?? undefined}
            error={fe?.event_name}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="event_type" className="mb-1.5">
                Type
              </Label>
              <Select
                id="event_type"
                name="event_type"
                defaultValue={current}
                aria-invalid={fe?.event_type ? true : undefined}
                style={{ colorScheme: "light" }}
                className={cn(
                  fe?.event_type &&
                    "border-danger-600 focus-visible:border-danger-600 focus-visible:ring-danger-600",
                )}
              >
                <option value="">— Select —</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              {fe?.event_type ? (
                <p className="mt-1 text-xs text-danger-600">{fe.event_type}</p>
              ) : null}
            </div>
            <Field
              label="Date"
              name="event_date"
              type="date"
              required
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
            <Label htmlFor="event_notes" className="mb-1.5">
              Notes
            </Label>
            <Textarea
              id="event_notes"
              name="event_notes"
              rows={3}
              defaultValue={v?.event_notes ?? undefined}
              aria-invalid={fe?.event_notes ? true : undefined}
              className={cn(
                fe?.event_notes &&
                  "border-danger-600 focus-visible:border-danger-600 focus-visible:ring-danger-600",
              )}
            />
            {fe?.event_notes ? (
              <p className="mt-1 text-xs text-danger-600">{fe.event_notes}</p>
            ) : null}
          </div>

          {state?.error ? (
            <p className="text-sm text-danger-600">{state.error}</p>
          ) : null}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={pending}>
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
