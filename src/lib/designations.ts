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
