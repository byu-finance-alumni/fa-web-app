/**
 * Treat "N/A"-style placeholders as absent.
 *
 * Legacy imports frequently store `n/a` in name fields — especially **spouse last
 * name** (most records have it) — where a literal "N/A" reads as junk in the UI.
 * `blankIfNa` normalizes those to an empty string for **display and edit prefill**
 * without mutating the stored value (a real save then persists the blank, quietly
 * cleaning the record).
 *
 * Detection strips every non-letter and lowercases, so it catches `n/a`, `N/A`,
 * `n.a`, `N.A.`, `n\a`, `n a`, and bare `na` alike. (A genuine surname that is
 * exactly "Na" would also blank on display — an accepted, data-preserving
 * tradeoff since the stored value is untouched.) Every other value is returned
 * unchanged (trimmed).
 */
export function blankIfNa(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  return v.replace(/[^a-z]/gi, "").toLowerCase() === "na" ? "" : v;
}
