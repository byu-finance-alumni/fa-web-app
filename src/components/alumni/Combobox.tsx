"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/alumni/form-fields";

/**
 * Pick-or-type combobox: a curated list of suggestions over a field that still
 * accepts free text.
 *
 * Use this — rather than `SelectField` — for a field that has a canonical list
 * but whose stored values are NOT constrained to it. Two such fields exist
 * today, for the same underlying reason (real data outruns the list):
 *
 *   - State (#451) — the 50 states + DC, but international alumni have
 *     provinces ("Ontario", "Bavaria") no US list will contain.
 *   - Secondary industry (#452) — the 21-term vocabulary, but the column is
 *     free text on the backend and always has been (`CareerCreate` validates
 *     the PRIMARY industry only, deliberately), so records already hold
 *     off-list values like "Insurance" and the CSV importer still accepts them.
 *
 * A strict `<select>` on either would remove a capability that exists today:
 * off-list records would become uneditable, and no NEW off-list value could be
 * entered. So the list is a suggestion, never a constraint:
 *
 *   - Anything typed is kept verbatim; there is no "invalid value" error here.
 *   - An off-list stored value loads and round-trips untouched, so editing a
 *     neighbouring field can't blank it — the same guarantee `withValue()` gives
 *     the strict selects, which a free-text field gets for free.
 *
 * Renders as a single named input, so it serializes into the surrounding
 * uncontrolled form's FormData exactly like the `<input>` it replaces.
 *
 * For a field that IS constrained to its vocabulary — the PRIMARY industry —
 * use `SelectField` instead. That one is validated server-side, and a strict
 * dropdown is the correct shape.
 */
export function Combobox({
  label,
  name,
  defaultValue = "",
  suggest,
  error,
  onSettle,
  hint,
}: {
  label: string;
  /** Form field name — this is what lands in FormData. */
  name: string;
  defaultValue?: string;
  /**
   * Suggestions for the current query. Called on every render, so callers with
   * a list that changes identity (e.g. a vocabulary fetch) should memoize it.
   * An empty query should return the full list.
   */
  suggest: (query: string) => readonly string[];
  error?: string;
  /**
   * Fires when the value SETTLES — a suggestion is picked, or the field is
   * left after being edited — with the new value. Deliberately not per
   * keystroke: half-typed input passes through states that resolve to the
   * wrong place, and a dependent field must not chase them. Typing "Montana"
   * passes through "Mo", which is Missouri's USPS code; a per-keystroke
   * listener would flash "Midwest" before landing on "West".
   *
   * Only fires when the value actually changed, so tabbing through an
   * untouched field is not a change.
   */
  onSettle?: (value: string) => void;
  /** Optional muted helper line shown under the field (non-error). */
  hint?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  // -1 = nothing highlighted: Enter then submits/accepts the typed text rather
  // than silently swapping in a suggestion the user never moved onto.
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  // Last value handed to `onSettle` — so blur after no edit stays silent.
  const settledRef = useRef(defaultValue);
  // `name` is a form field name, not a DOM-unique id — two of these can share a
  // page — so the listbox/option ids get a generated prefix.
  const uid = useId();
  const listboxId = `${uid}-listbox`;

  const suggestions = suggest(value);
  // Exact single match (the value typed in full) — the menu would just echo the
  // input back, so close it rather than park a redundant row over the form.
  const showList =
    open &&
    suggestions.length > 0 &&
    !(suggestions.length === 1 && suggestions[0] === value.trim());

  // Close on outside click (the menu floats over the fields below it).
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function settle(next: string) {
    if (next === settledRef.current) return;
    settledRef.current = next;
    onSettle?.(next);
  }

  function select(option: string) {
    setValue(option);
    settle(option);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Opening on the first ArrowDown is what makes the field discoverable
      // without a mouse.
      if (!showList) {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
        return;
      }
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const next =
        (activeIndex + delta + suggestions.length) % suggestions.length;
      setActiveIndex(next);
      e.preventDefault();
    } else if (e.key === "Enter") {
      // Only intercept Enter while a suggestion is highlighted — otherwise let
      // it reach the form (submit) as it would on any other text input.
      if (showList && activeIndex >= 0) {
        select(suggestions[activeIndex]);
        e.preventDefault();
      }
    } else if (e.key === "Escape") {
      if (showList) {
        setOpen(false);
        setActiveIndex(-1);
        e.stopPropagation();
      }
    }
  }

  const errorId = error ? `${uid}-error` : undefined;
  const hintId = hint ? `${uid}-hint` : undefined;

  return (
    <div ref={boxRef} className="relative">
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0 ? `${uid}-option-${activeIndex}` : undefined
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        // Settle on the way out — the typed value is final once focus leaves.
        onBlur={(e) => settle(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn(error && "border-danger-600 focus-visible:ring-danger-600")}
      />
      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s} role="none">
              <button
                type="button"
                id={`${uid}-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                // The input's blur would close the menu before a click lands.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => select(s)}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm text-gray-900",
                  i === activeIndex ? "bg-brand-blue-50" : "hover:bg-gray-50",
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
