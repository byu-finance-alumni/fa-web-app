/**
 * Pure suggestion-filtering for {@link Combobox}. No React, no `@/` imports, so
 * the matching rules stay unit-testable on their own.
 */

/**
 * Generic type-to-filter over a flat option list, case-insensitive.
 *
 * Prefix matches come first, then substring matches, each in the list's own
 * order — so the list's curated order (e.g. a vocabulary's `sort_order`, with
 * "Other" pinned last) survives filtering. An empty query offers everything, so
 * clicking into the field shows the full menu.
 *
 * Never returns something the caller didn't pass in: a query with no match
 * yields `[]`, which a pick-or-type combobox shows as "no menu", NOT as an
 * error — free text is still a valid entry.
 */
export function suggestFromList(
  options: readonly string[],
  query: string,
): readonly string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;

  const prefix: string[] = [];
  const contains: string[] = [];
  for (const opt of options) {
    const lower = opt.toLowerCase();
    if (lower.startsWith(q)) prefix.push(opt);
    else if (lower.includes(q)) contains.push(opt);
  }
  return [...prefix, ...contains];
}
