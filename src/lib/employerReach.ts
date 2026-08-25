/**
 * The Companies tile's sub-line — "Across 12 states and 4 countries" (#754).
 *
 * Lives here rather than inline in the dashboard page for the same reason
 * `industryBreakdown.ts` does: the page is an async Server Component vitest
 * can't mount, and the wording has three edge cases (singular, zero, and an
 * older backend) that are each one character away from reading wrong on a tile
 * nobody re-reads after it ships.
 *
 * Both figures come straight from `/dashboard/summary`. Before #754 the tile
 * said "Across 70 states" because the query counted every distinct
 * `current_state` string — spelling variants and non-US regions included. The
 * backend now folds through the canonical US-state list, so `employer_states`
 * is structurally capped at 51 (50 + DC) and everything outside the US is
 * counted separately as `employer_countries`.
 *
 * Wording is Jake's call, 2026-08-25: the plain "and M countries", NOT
 * "at least M countries". He was shown the hedged version and chose this one —
 * don't soften it back.
 */

/**
 * Pluralise a count against its own noun — the same inline shape the rest of
 * the app uses (`n === 1 ? "state" : "states"`), pulled out only because this
 * line has two nouns and would otherwise nest two ternaries inside a template.
 */
function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * The sub-line, or `null` when there is nothing truthful to say.
 *
 * `null` — meaning the tile renders its number with no context line at all —
 * follows the rule the rest of the KPI strip already keeps: a tile with no
 * context beats a tile with invented context. It happens in two ways:
 *
 *   - the backend hasn't sent `employer_states` (an older API predating the
 *     #754 change omits it entirely), or
 *   - both figures are zero, where "Across 0 states" is not context, it's
 *     noise. The tile's own value is already "0" in that case.
 *
 * A zero on ONE side drops just that clause rather than the whole line —
 * "Across 12 states and 0 countries" reads as a suspiciously precise nothing,
 * while "Across 12 states" is exactly the line the tile carried before #754.
 * The same applies in reverse for a roster that is entirely international.
 *
 * `employerCountries` is optional and treated as zero when absent, so the tile
 * degrades to the pre-#754 wording against a backend that doesn't return it
 * yet — rather than to no line at all, which would lose a figure we do have.
 */
export function employerReachSub(
  employerStates: number | null | undefined,
  employerCountries: number | null | undefined,
): string | null {
  if (employerStates == null) return null;

  const states = employerStates;
  const countries = employerCountries ?? 0;

  if (states <= 0 && countries <= 0) return null;
  if (countries <= 0) return `Across ${count(states, "state", "states")}`;
  if (states <= 0) return `Across ${count(countries, "country", "countries")}`;

  return `Across ${count(states, "state", "states")} and ${count(
    countries,
    "country",
    "countries",
  )}`;
}
