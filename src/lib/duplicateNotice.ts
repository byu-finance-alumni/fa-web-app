/**
 * The `?duplicate_of=` query parameter that carries a possible-duplicate
 * warning from a save onto the profile page (#627).
 *
 * Only IDs travel in the URL — the profile reads the matching records back from
 * the API — so the worst a hand-edited link can do is name a record that really
 * exists, or nothing. Parsing lives here rather than in the page so it can be
 * tested without pulling in a server component's whole import graph.
 */

/** `"77,88"` -> `[77, 88]`. Anything that isn't a positive integer is dropped. */
export function parseDuplicateOf(
  raw: string | string[] | undefined,
): number[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}
