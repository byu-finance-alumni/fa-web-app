"use client";

import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { FieldLabel } from "@/components/alumni/form-fields";

/**
 * Region dropdown for `contact.region` (#451).
 *
 * Two things `SelectField` can't do, which is why this exists:
 *
 *  1. It renders CONTROLLED when a `value` is passed, so picking an Employment
 *     State can auto-fill it. It stays a normal editable `<select>` — Tanya
 *     explicitly chose overridable over automatic, so this is never read-only
 *     or disabled.
 *  2. It takes a `hint`, so an auto-fill can announce itself. A value changing
 *     under the cursor with no explanation reads as a bug.
 *
 * `options` must come from `GET /vocabulary/state-regions` (`regions`), not a
 * hardcoded array — see `useStateRegions`.
 *
 * NOTE ON MEANING: region physically lives on the contact/residence row, but as
 * of #283 it describes where the alum WORKS, not where they live. An alum
 * living in Idaho and working in New York is "Northeast". Render this next to
 * the employment fields, never next to the home address, or the label lies.
 */
export function RegionSelect({
  name,
  options,
  value,
  defaultValue = "",
  onChange,
  error,
  hint,
  label = "Region",
}: {
  name: string;
  options: readonly string[];
  /** When provided, renders CONTROLLED (value + onChange) so it can auto-fill. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: string;
  /** Muted helper line under the field — used to explain an auto-fill. */
  hint?: string;
  label?: string;
}) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  const controlled = value !== undefined;

  return (
    <div>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Select
        id={name}
        name={name}
        {...(controlled ? { value } : { defaultValue })}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        className={cn(error && "border-danger-600 focus-visible:ring-danger-600")}
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
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-brand-blue-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
