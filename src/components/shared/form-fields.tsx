"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

/**
 * Shared form UI primitives for every add/edit form in the app.
 *
 * These started life inside {@link AlumniForm} and moved here (#611) so the
 * events forms render the SAME controls as the alumni ones — same labels, same
 * required marking, same error styling, same section card. "Add event" is meant
 * to be recognisable to anyone who has used "Add alumni", and that only holds if
 * both are literally built from these components rather than from lookalike
 * copies that drift apart.
 *
 * `@/components/alumni/form-fields` re-exports this module, so the alumni call
 * sites keep their original import path.
 *
 * Pure presentational building blocks with no closure over any form's state —
 * each form keeps its own validation/step logic.
 */

export function FieldLabel({
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

export function Field({
  label,
  name,
  defaultValue,
  value,
  type = "text",
  error,
  onBlur,
  onChange,
  required,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  /** When provided, the input renders CONTROLLED (value + onChange). Leave
   * undefined for the default uncontrolled (`defaultValue`) behavior. */
  value?: string;
  type?: string;
  error?: string;
  onBlur?: (name: string, value: string) => void;
  /** Fires on every keystroke with the field's current value. */
  onChange?: (name: string, value: string) => void;
  required?: boolean;
  placeholder?: string;
  /** Optional muted helper line shown under the field (non-error). */
  hint?: string;
}) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  const controlled = value !== undefined;
  return (
    <div>
      <FieldLabel htmlFor={name} required={required}>
        {label}
      </FieldLabel>
      <Input
        id={name}
        name={name}
        type={type}
        {...(controlled ? { value } : { defaultValue })}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        onBlur={onBlur ? (e) => onBlur(name, e.target.value) : undefined}
        onChange={onChange ? (e) => onChange(name, e.target.value) : undefined}
        // Date pickers otherwise inherit the OS colour scheme and render a dark
        // calendar widget on a light form.
        style={type === "date" ? { colorScheme: "light" } : undefined}
        className={cn(
          error && "border-danger-600 focus-visible:ring-danger-600",
        )}
      />
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

export function SelectField({
  label,
  name,
  options,
  error,
  defaultValue = "",
  hint,
}: {
  label: string;
  name: string;
  options: readonly string[];
  error?: string;
  defaultValue?: string;
  /** Optional muted helper line shown under the field (non-error). */
  hint?: string;
}) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        style={{ colorScheme: "light" }}
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
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-brand-blue-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
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

/** Label + multiline textarea with inline error styling (matches Field). */
export function TextareaField({
  label,
  name,
  defaultValue,
  rows = 3,
  error,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
  error?: string;
  placeholder?: string;
  /** Optional muted helper line shown under the field (non-error). */
  hint?: string;
}) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        className={cn(
          error && "border-danger-600 focus-visible:ring-danger-600",
        )}
      />
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

export function Section({
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
