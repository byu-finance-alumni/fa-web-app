"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  PREFERRED_CONTACT_NONE,
  preferredContactOptions,
  resolvePreferredContact,
  type PreferredContactValues,
} from "@/components/alumni/preferred-contact";

/**
 * Radio group picking which contact method shows at the top of the profile (#449).
 *
 * RADIOS, not checkboxes: the header renders exactly one contact link, so the
 * choice is mutually exclusive and a tick-both control would just be a bug
 * waiting to happen. A radio group can't be un-ticked, so the "no preference"
 * member is the explicit clear affordance — it submits blank, which the server
 * action turns into an explicit `null`.
 *
 * Rendered by BOTH the full `AlumniForm` and the focused `PersonalSectionForm`
 * so the two can't drift. Contact fields are already gated behind
 * `canViewContactDetails` / edit access at the page level, and this control
 * lives inside those same forms, so it inherits that gating.
 *
 * Text-only, per house style — no icons.
 */
export function PreferredContactPicker({
  name,
  values,
  defaultValue = PREFERRED_CONTACT_NONE,
  error,
}: {
  /** Input name, e.g. `contact.preferred_contact_method`. */
  name: string;
  /** Live text of the fields this picker selects, so an empty one is blocked. */
  values: PreferredContactValues;
  /** The method stored on the record ("" for none). */
  defaultValue?: string;
  error?: string;
}) {
  const [picked, setPicked] = useState(defaultValue);
  const options = preferredContactOptions(values, defaultValue);
  // Derived at render (not in an effect): if the field a selection points at is
  // emptied, the selection collapses to "no preference" immediately.
  const selected = resolvePreferredContact(options, picked);
  const errorId = error ? `${name}-error` : undefined;

  return (
    <fieldset aria-describedby={errorId}>
      <legend className="mb-1.5 text-sm font-medium text-gray-900">
        Preferred contact method
      </legend>
      <p className="mb-2 text-xs text-gray-500">
        Shown at the top of the profile. Fill in a field to make its option
        selectable.
      </p>
      <div className="space-y-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex items-center gap-2 text-sm",
              o.disabled ? "text-gray-400" : "text-gray-700",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected === o.value}
              disabled={o.disabled}
              onChange={() => setPicked(o.value)}
              className="h-4 w-4 border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500 disabled:cursor-not-allowed"
            />
            {o.label}
            {o.disabled ? (
              <span className="text-xs text-gray-400">(no value entered)</span>
            ) : null}
            {o.preserved ? (
              <span className="text-xs text-gray-500">(currently set)</span>
            ) : null}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name={name}
            value={PREFERRED_CONTACT_NONE}
            checked={selected === PREFERRED_CONTACT_NONE}
            onChange={() => setPicked(PREFERRED_CONTACT_NONE)}
            className="h-4 w-4 border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
          />
          No preference (use personal email)
        </label>
      </div>
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
