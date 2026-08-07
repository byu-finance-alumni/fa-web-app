/**
 * Shared URL-safety and LinkedIn rules (api #418).
 *
 * Two jobs live here on purpose, because they answer two different questions
 * about the same column:
 *
 *  1. `safeExternalHref` is the RENDER-side guard — "is this stored string safe
 *     to hand to an `href` at all?" The public survey lets an alum submit any
 *     string for `linkedin_url`, and staff then click that value from an
 *     authenticated session, so `javascript:` (and friends) must never reach the
 *     DOM. It is deliberately SCHEME-only: it does not care whether the host is
 *     LinkedIn, because the database already holds whatever it holds and a
 *     legacy `https://` link pointing elsewhere is wrong data, not an attack.
 *  2. `validateLinkedinUrl` is the INPUT-side rule — the linkedin.com hostname
 *     check the forms show inline. Extracted from `AlumniForm`'s local
 *     `validateField` so "Add alumni", profile Edit → Employment, and the public
 *     survey apply the IDENTICAL rule. Same reason `nameValidation` exists:
 *     three hand-maintained copies of a rule drift the moment one is touched.
 *
 * NEITHER is the security control. The backend re-validates on write and stays
 * the source of truth; this module is the defence-in-depth layer on both ends of
 * it — the write side can be fixed and the rows already stored are still
 * whatever they are, which is exactly why the render side has its own guard.
 */

/**
 * The only schemes we will put into an `href` built from stored data.
 *
 * `mailto:`/`tel:` are absent on purpose — those hrefs are assembled by the app
 * from a known prefix (`mailto:${email}`), so their scheme is never
 * attacker-chosen and they do not pass through here.
 */
const SAFE_SCHEMES: readonly string[] = ["http:", "https:"];

/**
 * The stored value as a safe absolute URL, or `null` when it isn't one.
 *
 * Callers render the text WITHOUT a link on `null` — a dead value is more
 * honest than a live link pointing somewhere we didn't intend.
 */
export function safeExternalHref(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (v === "") return null;

  let url: URL;
  try {
    // Parsed, never regex-matched against the raw string. The WHATWG parser is
    // the one the browser itself will use, so it collapses the tricks a regex
    // misses before the scheme is read: embedded tabs/newlines
    // (`java\nscript:alert(1)`), leading control characters, and mixed casing
    // all normalise first.
    url = new URL(v);
  } catch {
    // No scheme, protocol-relative (`//evil.example`), or plain junk. A
    // relative href would resolve against OUR origin — broken rather than
    // dangerous, but either way not a link worth rendering.
    return null;
  }

  if (!SAFE_SCHEMES.includes(url.protocol)) return null;
  // The parser's normalised form, not the raw input: it is what the browser
  // would navigate to anyway, so returning it removes the gap between what we
  // checked and what we emit.
  return url.href;
}

/** Whether {@link safeExternalHref} would produce a link for this value. */
export function isSafeHref(raw: string | null | undefined): boolean {
  return safeExternalHref(raw) !== null;
}

/** Mirrors the backend cap and the alumni table's `String(500)`. */
export const LINKEDIN_URL_MAX_LEN = 500;

/**
 * Validate one LinkedIn URL value. Returns an error message, or `null` when
 * valid. An empty value is valid everywhere — the field is optional on all
 * three forms.
 */
export function validateLinkedinUrl(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return null;
  if (v.length > LINKEDIN_URL_MAX_LEN)
    return `Must be ${LINKEDIN_URL_MAX_LEN} characters or fewer.`;
  // Scheme-gated first, so `javascript:linkedin.com` can't reach the hostname
  // check at all — the two rules compose rather than sitting side by side.
  const safe = safeExternalHref(v);
  if (safe === null)
    return "Enter a full URL, e.g. https://www.linkedin.com/in/you.";
  const host = new URL(safe).hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com"))
    return "Must be a linkedin.com URL.";
  return null;
}
