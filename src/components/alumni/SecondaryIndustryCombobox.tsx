"use client";

import { useCallback } from "react";
import { Combobox } from "@/components/alumni/Combobox";
import { suggestFromList } from "@/components/alumni/combobox-suggest";
import { SECONDARY_INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import { useVocabOptions } from "@/hooks/useVocabOptions";

/**
 * Secondary industry field (`career.current_industry_secondary`).
 *
 * Pick-or-type, NOT a strict dropdown — the distinction from the primary
 * industry is deliberate on both sides of the wire:
 *
 *   - PRIMARY (`current_industry`) is a controlled vocabulary. `CareerCreate`
 *     runs `validate_industry` on it and 422s an off-list value, so a strict
 *     `SelectField` is the honest shape.
 *   - SECONDARY is free text and always has been — `CareerCreate` documents
 *     that it is "intentionally NOT validated against INDUSTRIES", and the CSV
 *     importer accepts anything here too (there are already alumni whose
 *     secondary is e.g. "Insurance").
 *
 * So a strict `<select>` here would remove a capability that exists today:
 * `withValue` would preserve an off-list value already stored, but no NEW one
 * could be entered. Tanya gets the full 21-option list she asked for (#452),
 * which is what solves the spelling problem, without losing the open response.
 *
 * Options come from the vocabulary endpoint (`useVocabOptions`), not the
 * hardcoded constant — the constant is only the pre-fetch / on-error fallback.
 * The four industries hidden from the PRIMARY dropdown live here, which is the
 * entire reason they're hidden there rather than deleted.
 */
export function SecondaryIndustryCombobox({
  label,
  name,
  defaultValue = "",
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
}) {
  // Default scope — the FULL vocabulary, including Law / Corporate Banking /
  // Sales and Trading / Credit Risk.
  const options = useVocabOptions("industry", SECONDARY_INDUSTRY_OPTIONS);
  // Memoized on `options`, whose identity changes once when the fetch resolves.
  const suggest = useCallback(
    (query: string) => suggestFromList(options, query),
    [options],
  );

  return (
    <Combobox
      label={label}
      name={name}
      defaultValue={defaultValue}
      suggest={suggest}
      error={error}
      hint="Pick from the list or type your own."
    />
  );
}
