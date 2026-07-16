/**
 * Pure helpers behind the state combobox and the region auto-fill (#451).
 *
 * Kept in a plain `.ts` module (no JSX, no hooks) so the matching/normalizing
 * rules are unit-testable on their own and shared by every form that edits a
 * state — the full `AlumniForm` wizard and the focused `PersonalSectionForm` /
 * `EmploymentSectionForm` section forms.
 */

import { US_STATES } from "./us-states";

/** The 50 states + DC as canonical FULL display names, in `US_STATES` order. */
export const STATE_NAMES: readonly string[] = US_STATES.map((s) => s.name);

/** USPS code (upper) -> canonical full name. */
const NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.code, s.name]),
);

/** Lower-cased full name -> canonical full name (fixes casing). */
const NAME_BY_LOWER_NAME: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.name.toLowerCase(), s.name]),
);

/**
 * Canonical full state name for a code OR a full name, in any casing.
 *
 * Mirrors `to_full_name` in fa-web-api/app/core/us_states.py, which the backend
 * runs on write before deriving a region — so a value looked up here resolves
 * to the same key the server would use.
 *
 * * `null` / blank (after trim) -> `""`.
 * * A recognized 2-letter code ("ut", "UT") -> its full name ("Utah").
 * * A recognized full name in any casing ("utah", "UTAH") -> "Utah".
 * * Anything else (an international province, a typo) -> the trimmed input,
 *   untouched. Free text is a supported value, not an error.
 */
export function toFullStateName(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length === 2 && /^[a-z]{2}$/i.test(trimmed)) {
    const byCode = NAME_BY_CODE[trimmed.toUpperCase()];
    if (byCode) return byCode;
  }
  return NAME_BY_LOWER_NAME[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Type-to-filter suggestions for the state combobox.
 *
 * Matches a state whose NAME starts with the query, or whose USPS CODE equals
 * it — prefix-first so typing "co" surfaces Colorado/Connecticut, and typing a
 * code ("UT") surfaces Utah. Name-prefix matches come first, then code matches,
 * then names containing the query ("york" -> New York), each in list order.
 * An empty query offers the whole list (a click into the field shows the menu).
 *
 * Only the 50 states + DC are ever suggested — no territories. The field still
 * ACCEPTS anything typed (international provinces like "Ontario" / "Bavaria"),
 * so a state with no match here is a valid entry, just an unsuggested one.
 */
export function stateSuggestions(query: string): readonly string[] {
  const q = query.trim().toLowerCase();
  if (!q) return STATE_NAMES;

  const namePrefix: string[] = [];
  const codeMatch: string[] = [];
  const contains: string[] = [];
  for (const { name, code } of US_STATES) {
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) namePrefix.push(name);
    else if (code.toLowerCase() === q) codeMatch.push(name);
    else if (lower.includes(q)) contains.push(name);
  }
  return [...namePrefix, ...codeMatch, ...contains];
}

/**
 * The region a state belongs to, or `null` when it has none.
 *
 * `regionByState` is the server's `region_by_state` crosswalk from
 * `GET /vocabulary/state-regions`, keyed by canonical FULL state name — the
 * frontend deliberately keeps NO copy of that map (#451), so this resolves
 * nothing on its own and returns `null` until the fetch lands.
 *
 * Returns `null` for a blank state and for any non-US / unrecognized value
 * (an international province has no US region), which is the same "leave the
 * stored region alone" outcome `derive_region` produces server-side.
 */
export function regionForState(
  regionByState: Readonly<Record<string, string>> | null | undefined,
  state: string | null | undefined,
): string | null {
  if (!regionByState) return null;
  const full = toFullStateName(state);
  if (!full) return null;
  return regionByState[full] ?? null;
}

/**
 * The region for a state the user is still TYPING — the responsive half of the
 * auto-fill, resolved per keystroke rather than on settle.
 *
 * Deliberately stricter than {@link regionForState}: it matches a COMPLETE full
 * state name only (case-insensitive, trimmed) and does NOT expand USPS codes.
 * That restriction is the whole point, and it is load-bearing — half-typed input
 * passes through strings that are valid codes for the WRONG state. Typing
 * "Montana" passes through "Mo", which is Missouri's code; expanding it here
 * would flash "Midwest" under the cursor before landing on "Mountain West". So:
 *
 *   * "Texas" / "texas" / " TEXAS " -> "Southwest" — resolved on the keystroke
 *     that completes the name, no blur needed.
 *   * "Mo", "Tex", "Ne" -> `null`. Not a rejection: keep typing. Callers must
 *     leave the existing region ALONE on `null`, never blank it.
 *   * "TX" -> `null` here. A code still resolves, just on settle (blur / picking
 *     a suggestion), where `regionForState` runs with full expansion.
 *
 * Same `null` contract as `regionForState` otherwise: nothing before the
 * crosswalk lands, nothing for a non-US value.
 */
export function regionForTypedState(
  regionByState: Readonly<Record<string, string>> | null | undefined,
  typed: string | null | undefined,
): string | null {
  if (!regionByState) return null;
  const trimmed = (typed ?? "").trim();
  if (!trimmed) return null;
  // Exact full-name hit only — no NAME_BY_CODE lookup, on purpose (see above).
  const full = NAME_BY_LOWER_NAME[trimmed.toLowerCase()];
  if (!full) return null;
  return regionByState[full] ?? null;
}
