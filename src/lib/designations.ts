/**
 * Shared designation abbreviation → full-name map and lookup helpers (#405).
 *
 * A SINGLE source of truth for expanding professional-certification and license
 * abbreviations shown on the alumni profile (the "Graduate degrees &
 * designations" box especially) into their full names for an accessible hover
 * tooltip. Rendered as a native `<abbr title>` at the call site — text-only, no
 * icon, no extra dependency — matching the app's existing `title=` tooltip
 * convention.
 *
 * Keys are normalized (uppercase, single-spaced) so lookups are case- and
 * spacing-insensitive. Only well-known finance/accounting designations are
 * mapped; an unknown token simply renders as plain text with no tooltip.
 */
export const DESIGNATION_FULL_NAMES: Record<string, string> = {
  // Core certifications surfaced on the profile.
  CFP: "Certified Financial Planner",
  CFA: "Chartered Financial Analyst",
  CPA: "Certified Public Accountant",
  // Other common finance/accounting designations that may appear in the
  // free-text `other_designations` field.
  FRM: "Financial Risk Manager",
  CAIA: "Chartered Alternative Investment Analyst",
  CHFC: "Chartered Financial Consultant",
  CLU: "Chartered Life Underwriter",
  CIMA: "Certified Investment Management Analyst",
  CMA: "Certified Management Accountant",
  CIA: "Certified Internal Auditor",
  EA: "Enrolled Agent",
  // FINRA securities licenses (Series exams).
  "SERIES 3": "National Commodity Futures License (Series 3)",
  "SERIES 6": "Investment Company / Variable Contracts Representative (Series 6)",
  "SERIES 7": "General Securities Representative License (Series 7)",
  "SERIES 24": "General Securities Principal License (Series 24)",
  "SERIES 63": "Uniform Securities Agent State Law License (Series 63)",
  "SERIES 65": "Uniform Investment Adviser Law License (Series 65)",
  "SERIES 66": "Uniform Combined State Law License (Series 66)",
  "SERIES 79": "Investment Banking Representative License (Series 79)",
};

/** Normalize a token for map lookup: trim, collapse inner whitespace, uppercase. */
function normalize(token: string): string {
  return token.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Full name for a designation token, or `null` when the token isn't a known
 * designation (caller then renders it as plain text with no tooltip).
 */
export function designationFullName(
  token: string | null | undefined,
): string | null {
  if (!token) return null;
  return DESIGNATION_FULL_NAMES[normalize(token)] ?? null;
}

/**
 * Split a free-text designations string (e.g. `"Series 7, Series 63"`) into
 * individual tokens on common delimiters so each can be looked up for a tooltip.
 * Returns a single-element array when there are no delimiters.
 */
export function splitDesignations(text: string): string[] {
  return text
    .split(/[,;/|•]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/* ------------------------------------------- survey "Other" blanks (#529) -- */

/**
 * How many free-text "Other" blanks the survey offers alongside the CFA and CFP
 * tickboxes. Jake's spec is literally three; the rest of this module derives
 * from the constant so widening it later is a one-line change.
 */
export const OTHER_DESIGNATION_SLOTS = 3;

/**
 * Fill the survey's fixed set of "Other" blanks from the single comma-joined
 * `other_designations` string we store.
 *
 * Always returns exactly `OTHER_DESIGNATION_SLOTS` entries. An alum with MORE
 * designations than there are blanks (dev already has 3-value rows, so 4+ is
 * plausible) keeps the overflow in the LAST blank, re-joined with ", " — the
 * alternative is dropping what they told us last year the moment they open the
 * form, which is worse than one crowded box they can edit.
 */
export function splitOtherDesignationSlots(text: string): string[] {
  const parts = splitDesignations(text ?? "");
  const slots: string[] = [];
  for (let i = 0; i < OTHER_DESIGNATION_SLOTS - 1; i += 1) {
    slots.push(parts[i] ?? "");
  }
  slots.push(parts.slice(OTHER_DESIGNATION_SLOTS - 1).join(", "));
  return slots;
}

/**
 * Collapse the "Other" blanks back into the one stored string. Empty blanks are
 * skipped rather than emitted as stray commas, and the alum's own order is
 * preserved — we never sort or dedupe what they typed.
 */
export function joinOtherDesignationSlots(slots: readonly string[]): string {
  return slots
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}
