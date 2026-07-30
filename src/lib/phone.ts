/**
 * Format a US phone number for display.
 *
 * A 10-digit number (or 11 digits with a leading country-code "1") renders as
 * "(555) 123-4567". Anything else — an international number, a partial entry, or
 * an already-formatted value — is returned unchanged, so we never mangle a
 * number we don't recognize. Use this only for DISPLAY; keep the raw value for
 * `tel:` links and storage.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length === 10) {
    return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  }
  return raw;
}
