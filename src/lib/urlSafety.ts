/**
 * Shared URL-safety rules — the LinkedIn pair (api #418) and the post-login
 * return path (#682).
 *
 * The first two jobs live here on purpose, because they answer two different
 * questions about the same column:
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
 * Neither of those two IS the security control. The backend re-validates on
 * write and stays the source of truth; they are the defence-in-depth layer on
 * both ends of it — the write side can be fixed and the rows already stored are
 * still whatever they are, which is exactly why the render side has its own
 * guard.
 *
 *  3. `safeNextPath` / `returnPathFor` / `loginPathWithNext` are the REDIRECT
 *     rule (#682) — "may we send the user to this place after they sign in?"
 *     Unlike the two above, this one IS the security control and has no backend
 *     behind it: the destination arrives as `?next=` on a URL an attacker can
 *     hand a victim, and nothing downstream re-checks it. Keeping it in this
 *     module rather than inline in the login action is what lets the login
 *     action, the middleware and the two client-side sign-out paths all apply
 *     the identical rule.
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

/* ------------------------------------------------------------------ *
 * Post-login return path (#682)
 * ------------------------------------------------------------------ */

/**
 * Where a signed-in user lands when there is no valid place to return them to.
 * Also the middleware's "already signed in, get off /login" destination, which
 * imports this constant so the two can never drift apart.
 */
export const APP_HOME = "/dashboard";

/**
 * A base used ONLY to resolve a candidate return path so its origin can be
 * compared against something. Any absolute URL works — the question we ask is
 * "does resolving against this base LEAVE this base's origin?", and the answer
 * is independent of which base we pick. `.invalid` is reserved by RFC 2606, so
 * it can never collide with a host anyone could actually register.
 */
const RESOLUTION_BASE = "https://app.invalid";

/**
 * Same-origin paths we still refuse to return a user to. `/login` would bounce
 * straight off itself — the middleware sends a signed-in user sitting on
 * `/login` to APP_HOME — so honouring it costs a visible flash of the login
 * page and gains nothing.
 */
const NON_RETURNABLE = new Set<string>(["/login"]);

/**
 * The safe destination for a `?next=` value: the path itself when it is a
 * genuine same-origin path of this app, {@link APP_HOME} otherwise.
 *
 * WHY THIS IS PARSED RATHER THAN STRING-MATCHED. The check this replaced was
 * `next.startsWith("/") && !next.startsWith("//")`, which reads like an
 * origin check and is not one. Per the WHATWG URL spec a browser treats `\` as
 * `/` in the authority position of a special scheme, and it strips tab/CR/LF
 * from the input before parsing — so ALL of these cleared that test and still
 * resolved off-origin:
 *
 *   "/\evil.com"      → https://evil.com/
 *   "/\/evil.com"     → https://evil.com/
 *   "/<TAB>/evil.com" → https://evil.com/
 *   "/<LF>/evil.com"  → https://evil.com/
 *
 * Comparing the RESOLVED origin is the only form that cannot be talked around,
 * because the thing answering is the same parser the browser will use when it
 * performs the navigation. The value returned is the parser's normalised form
 * rather than the raw input, so what we validated is exactly what we emit.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string" || next === "") return APP_HOME;
  // Must be a PATH reference. This rejects absolute URLs ("https://evil.com"),
  // non-hierarchical schemes ("javascript:alert(1)") and bare relative segments
  // ("dashboard") that would only resolve correctly by accident. It is NOT the
  // origin check — the resolved-origin comparison below is.
  if (!next.startsWith("/")) return APP_HOME;

  let url: URL;
  try {
    url = new URL(next, RESOLUTION_BASE);
  } catch {
    return APP_HOME;
  }

  if (url.origin !== RESOLUTION_BASE) return APP_HOME;
  if (NON_RETURNABLE.has(url.pathname)) return APP_HOME;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** Whether {@link safeNextPath} would honour this value as-is. */
export function isReturnablePath(next: string | null | undefined): boolean {
  return typeof next === "string" && next !== "" && safeNextPath(next) === next;
}

/**
 * Query parameters that are never carried into `?next=`.
 *
 * `next` round-trips a URL the user was on into a link that then sits in the
 * address bar of a page that is, by definition, NOT yet authenticated — and in
 * the browser history, the referrer and any log that records the login URL. A
 * credential that happened to be in the original query string must not make
 * that trip. No protected page reads any of these today (the survey token is a
 * PATH segment on `/survey/*`, which never reaches this code — the middleware
 * returns before auth for it — and Supabase recovery links carry their token in
 * the URL FRAGMENT, which is never sent to the server); the list is here so a
 * page that later grows such a parameter cannot leak it by default.
 */
const SENSITIVE_NEXT_PARAMS: readonly string[] = [
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "code",
  "id_token",
  "otp",
  "password",
  "refresh_token",
  "secret",
  "session",
  "signature",
  "token",
  "token_hash",
];

/**
 * The `?next=` value for a page the user was on, or `null` when there is
 * nothing worth (or safe) carrying.
 *
 * THE WRITE SIDE of the redirect rule, and the fix for #791. Every sign-out
 * path used to hand over a bare pathname, so a filtered link — the whole of the
 * Reports tab, and Data quality — came back from the login screen as an
 * UNFILTERED list with nothing on screen to say a filter had been dropped. The
 * query string is part of the destination, so it travels with it.
 *
 * The value returned is the one `safeNextPath` will hand back unchanged: the
 * last line re-asks the read side rather than assuming the two agree, because a
 * `next` we emit but the login action then quietly drops is exactly the silent
 * failure this whole module exists to prevent.
 */
export function returnPathFor(
  current: string | null | undefined,
): string | null {
  if (typeof current !== "string" || current === "") return null;
  if (!current.startsWith("/")) return null;

  let url: URL;
  try {
    url = new URL(current, RESOLUTION_BASE);
  } catch {
    return null;
  }
  if (url.origin !== RESOLUTION_BASE) return null;
  if (NON_RETURNABLE.has(url.pathname)) return null;

  // Only rewrite the query when there is genuinely something to remove:
  // mutating `searchParams` re-serialises the WHOLE string, which turns a
  // `%20` into a `+`. Both decode to a space, so it is correct either way, but
  // the common case — a filtered list with no credential in sight — should come
  // back byte-for-byte as it went in.
  if (SENSITIVE_NEXT_PARAMS.some((name) => url.searchParams.has(name)))
    SENSITIVE_NEXT_PARAMS.forEach((name) => url.searchParams.delete(name));

  const candidate = `${url.pathname}${url.search}${url.hash}`;
  return isReturnablePath(candidate) ? candidate : null;
}

/**
 * The page the browser is on right now, as a `?next=` value.
 *
 * For the CLIENT-side sign-out paths only. They read `window.location` at the
 * moment of the redirect rather than tracking the URL in React state: a filter
 * change on the alumni list rewrites only the query string, which `usePathname`
 * does not report, so anything cached off it is stale exactly when the filter
 * is the thing worth keeping (#791).
 */
export function currentReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  const { pathname, search } = window.location;
  return returnPathFor(`${pathname}${search}`);
}

/**
 * The `/login` URL to send a user to when their session ends, remembering the
 * page they were on.
 *
 * Every way a session can end must produce the same URL shape, or "take me back
 * to where I was" works only sometimes — which was the actual bug behind #682.
 * The middleware builds its redirect from `NextURL`, so this helper serves the
 * two CLIENT-side sign-outs (idle timeout, signed-out-on-another-device) and
 * keeps their `?reason=` / `?signedout=` notices intact alongside `next`.
 *
 * `currentPath` may carry a query string; both callers pass
 * {@link currentReturnPath}, which supplies one.
 */
export function loginPathWithNext(
  currentPath: string | null | undefined,
  params: Record<string, string> = {},
): string {
  const search = new URLSearchParams(params);
  // Only advertise a destination the login action would actually honour, so the
  // URL can never promise a return the other end quietly drops.
  const next = returnPathFor(currentPath);
  if (next) search.set("next", next);
  const query = search.toString();
  return query ? `/login?${query}` : "/login";
}
