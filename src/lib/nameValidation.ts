/**
 * Shared client-side validation for person-name inputs (#626).
 *
 * Extracted from `AlumniForm`'s local `validateField` so the Add form and the
 * profile Edit → "Personal & family information" section apply the SAME rules.
 * The point of sharing rather than copying: edit must never be laxer than
 * create, and two hand-maintained copies of a regex drift the moment one side
 * is touched.
 *
 * The backend (`AlumniBase._validate_name`) remains authoritative — it enforces
 * the same 100-char cap plus control-character, leading `+ - @` (CSV formula
 * injection) and disallowed-character rules, and it title-cases the value on
 * write. This module is the inline, pre-submit half of that contract.
 */

/** Mirrors the backend `_NAME_MAX` and the alumni table's `String(100)`. */
export const NAME_MAX_LEN = 100;

/**
 * Letters (any script, so accented and non-Latin names pass), spaces,
 * apostrophes, hyphens and periods. Deliberately permissive about scripts and
 * deliberately strict about punctuation/digits.
 */
const NAME_RE = /^[\p{L} '.-]+$/u;

/**
 * Validate one name value. Returns an error message, or `null` when valid.
 *
 * `required` is passed by the caller rather than baked in per field because the
 * two call sites differ: Add always requires first + last, while Edit only
 * requires them when the record already HAS them (see
 * `PersonalSectionForm` — a legacy record imported with no name must stay
 * editable, but a name that exists must not be erasable).
 */
export function validateName(
  raw: string,
  opts: { required?: boolean } = {},
): string | null {
  const v = raw.trim();
  if (v === "") return opts.required ? "Required." : null;
  if (v.length > NAME_MAX_LEN)
    return `Must be ${NAME_MAX_LEN} characters or fewer.`;
  if (!NAME_RE.test(v))
    return "Only letters, spaces, apostrophes, hyphens, and periods.";
  return null;
}
