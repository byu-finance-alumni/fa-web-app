"use client";

import { Combobox } from "@/components/alumni/Combobox";
import { stateSuggestions } from "@/lib/geo/state-field";

/**
 * State field (#451): the 50 states + DC as type-to-filter suggestions, using
 * their FULL names ("Utah", never "UT") — Tanya's preference, and the storage
 * convention the backend normalizes to (`to_full_name` in
 * app/core/us_states.py).
 *
 * A {@link Combobox}, not a `<select>`, because international alumni have a
 * province ("Ontario", "Bavaria") no US list will ever contain — see that
 * component for what pick-or-type guarantees. The backend still normalizes on
 * write, so the suggestions are a UX improvement and a backstop, not the only
 * defense against a typo.
 *
 * Only the 50 states + DC are ever suggested — no territories.
 */
export function StateCombobox({
  label,
  name,
  defaultValue = "",
  error,
  onSettle,
  onType,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  /** Fires with the settled value — see `Combobox`'s `onSettle`. */
  onSettle?: (value: string) => void;
  /**
   * Fires per keystroke with the raw text — see `Combobox`'s `onType`. For a
   * dependent field, resolve it with `regionForTypedState` (full names only),
   * NOT `toFullStateName`, or a half-typed "Mo" will read as Missouri.
   */
  onType?: (raw: string) => void;
  hint?: string;
}) {
  return (
    <Combobox
      label={label}
      name={name}
      defaultValue={defaultValue}
      // A module-level function over a static list — stable by construction,
      // so there is nothing to memoize.
      suggest={stateSuggestions}
      error={error}
      onSettle={onSettle}
      onType={onType}
      hint={hint}
    />
  );
}
