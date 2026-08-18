/**
 * Residence location formatting (#owner request, 2026-08-17).
 *
 * The alum's RESIDENCE lives on three contact columns — `contact.city`,
 * `contact.state`, `contact.country` — the same three the survey writes and the
 * Personal edit section captures. The profile used to print them as separate
 * "Current city" / "Current state" / "Residence city" fields; the owner asked
 * for one line instead: "Residence Location — Provo, Utah".
 *
 * NOT to be confused with `alumni.home_country`, which is the country of ORIGIN
 * (where the alumnus is FROM) and is rendered separately alongside citizenship.
 * The two are deliberately distinct columns and must never be merged here.
 */

import { US_CANONICAL, normalizeCountryName } from "@/lib/geo/world-countries";

/** Trim, and treat a whitespace-only cell (a real thing in imported rows) as
 *  absent rather than as a value that would leave a dangling comma. */
const clean = (value: string | null | undefined): string | null => {
  const v = (value ?? "").trim();
  return v.length ? v : null;
};

/**
 * True when a stored country means the United States. Matched
 * case-insensitively against a small alias set ("USA", "US", "United States of
 * America", "America", …) rather than one exact spelling, because the column is
 * partly free text from the intake sheet and the survey.
 *
 * A blank country counts as domestic: the overwhelming majority of records have
 * no country on file and are in the US, so a missing value must not turn into a
 * visible country segment.
 */
export function isUnitedStates(country: string | null | undefined): boolean {
  const v = clean(country);
  if (!v) return true;
  return normalizeCountryName(v) === US_CANONICAL;
}

/**
 * Combine the three residence columns into one display line.
 *
 *   ("Provo", "Utah", "United States") → "Provo, Utah"
 *   ("Provo", null,   null)            → "Provo"
 *   (null,    "Utah", null)            → "Utah"
 *   ("Toronto", "Ontario", "Canada")   → "Toronto, Ontario, Canada"
 *   (null, null, null)                 → null   (caller renders an em-dash)
 *
 * The country is appended ONLY when it is genuinely non-US, so a domestic
 * address never reads "Provo, Utah, United States" while an international one
 * still identifies itself. `null` means "nothing on file" — callers must still
 * render the field with the page's standard em-dash empty state; hiding the row
 * is what made this data invisible last time.
 */
export function formatCityStateCountry(
  city: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const parts = [clean(city), clean(state)];
  const c = clean(country);
  if (c && !isUnitedStates(c)) parts.push(c);
  const line = parts.filter(Boolean).join(", ");
  return line.length ? line : null;
}

/**
 * Residence-specific alias of {@link formatCityStateCountry}.
 *
 * The same "City, State (+ country when not US)" shape is now used for BOTH a
 * residence and an employment location, which are genuinely different places -
 * an alum can work in Manhattan and live in New Jersey. Keeping a named alias
 * per meaning stops a future reader assuming the two call sites are the same
 * field, which is exactly the confusion that put residence in the employment
 * panel in the first place.
 */
export const formatResidenceLocation = formatCityStateCountry;
