/**
 * Ordering for the dashboard's Industry breakdown panel.
 *
 * Lives here rather than inside the dashboard page so it can be tested
 * directly — the page is an async Server Component that vitest can't mount, and
 * the ordering is exactly the kind of thing a later "tidy up the sort" change
 * breaks silently.
 */

/** The shape the panel needs to order a row. Callers carry more (an href), and
 *  keep it: the sort is generic so nothing is dropped on the way through. */
export interface IndustryRowLike {
  label: string;
  count: number;
}

/**
 * Biggest industry first, descending by count — the panel's whole job is "who
 * do we have the most of", so the answer has to be the top line rather than
 * something to be found by scanning bar lengths.
 *
 * Ties break on the label A→Z. That matters more than it looks: a comparator
 * that returns 0 for equal counts leaves the order to whatever the API happened
 * to send, so two industries on the same count could swap places between
 * renders for no visible reason.
 *
 * Zero-count industries are ORDERED last, never filtered — the backend lists
 * every canonical industry precisely so a category with nobody in it is visible
 * as a real zero (#397, "Financial Services"), and dropping them would turn an
 * answer back into an absence.
 *
 * Returns a new array; the input is not mutated.
 */
export function sortIndustryRows<T extends IndustryRowLike>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}
