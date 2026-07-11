/**
 * US state / territory name → USPS 2-letter code, plus a display helper.
 *
 * Single source of truth for turning the full state names stored on alumni
 * records ("California") into the compact codes the list table shows ("CA").
 * Covers all 50 states, DC, and the inhabited US territories, plus a couple of
 * common DC spellings. Keys are lowercase for case-insensitive lookup.
 */

/** Full state/territory name (lowercase) → USPS 2-letter code. */
export const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY",
  // District of Columbia (+ common spellings).
  "district of columbia": "DC", "washington dc": "DC", "washington d.c.": "DC",
  "d.c.": "DC",
  // Inhabited US territories.
  "puerto rico": "PR", guam: "GU", "u.s. virgin islands": "VI",
  "us virgin islands": "VI", "virgin islands": "VI", "american samoa": "AS",
  "northern mariana islands": "MP",
};

/** Every valid USPS code we recognize (deduped from the map values). */
const VALID_CODES = new Set(Object.values(STATE_NAME_TO_ABBR));

/**
 * Compact display for a state value. "California" → "CA". A value that is
 * already a valid 2-letter code passes through (upper-cased). Anything we don't
 * recognize is returned unchanged so unexpected data still shows, never blanks.
 * Empty / null input returns "" so the caller can render its own em-dash.
 */
export function abbreviateState(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (trimmed.length === 2 && VALID_CODES.has(upper)) return upper;
  return STATE_NAME_TO_ABBR[trimmed.toLowerCase()] ?? trimmed;
}
