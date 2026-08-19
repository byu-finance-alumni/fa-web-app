/**
 * Session lifetime policy — the ONE place the auth-cookie lifetime is defined
 * (issue #684).
 *
 * WHY THIS EXISTS
 * ---------------
 * `@supabase/ssr` defaults its auth cookie to a `maxAge` of 400 days (the
 * browser-imposed ceiling — see `DEFAULT_COOKIE_OPTIONS` in the package). Left
 * unset, that default was the only thing bounding how long a session could
 * live: the in-app idle timer lives in a React effect, so a reload/restart
 * resets it, and neither the backend nor single-active-session (#147) imposes a
 * maximum session age. A laptop that is stolen a week after someone last signed
 * in still carries a usable session cookie.
 *
 * WHY 12 HOURS
 * ------------
 * This app holds FERPA-protected alumni data and is used on staff laptops,
 * including shared machines. Twelve hours is one working day: a person who
 * signs in at the start of the day is not interrupted mid-task, and a machine
 * left overnight is dead by morning. Shorter (1-2h) would push staff through
 * repeated logins during normal work; longer (a week) would leave a lost laptop
 * usable for days. Twelve hours bounds the worst case to a single day without
 * making the tool annoying to use.
 *
 * NOTE — the cookie is only HALF of the control. Supabase's dashboard has its
 * own session settings ("Time-box user sessions" and "Inactivity timeout" under
 * Authentication -> Sessions) which are the SERVER-side enforcement and cannot
 * be set from this repo. They must be configured separately, on BOTH the dev
 * project (tnnhhnzglyfqolxdojyb) and the prod project (njobhhdopwdodvzosrns) —
 * dev and prod are separate Supabase projects, so a value set on one does not
 * apply to the other. That is the owner's task, not this module's. Without it, a
 * refresh token remains valid server-side even after this cookie is gone.
 *
 * WHAT WE DO NOT CHANGE
 * ---------------------
 * `httpOnly` stays `false`. It is false BY NECESSITY: the browser Supabase
 * client reads the session out of `document.cookie`, so flipping it breaks
 * auth outright. The mitigation for that is the nonce-based CSP (#30), not a
 * cookie flag. `sameSite` (lax) and `secure` are left at the library defaults —
 * `lax` is required for the OAuth/redirect round trips, and the deployment is
 * HTTPS-only in every environment that matters.
 */

/**
 * Maximum lifetime of the Supabase auth cookie, in seconds. Twelve hours.
 *
 * Every Supabase client factory (browser, server, middleware) applies this same
 * value; they MUST agree, because whichever one writes last wins and a
 * disagreement produces a confusing half-logged-in state.
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

/**
 * The `cookieOptions` object handed to every `createBrowserClient` /
 * `createServerClient` call. Only `maxAge` is set — everything else (path,
 * sameSite, httpOnly, secure) intentionally falls through to the library
 * defaults.
 *
 * IMPORTANT: passing this alone is NOT sufficient on `@supabase/ssr` 0.10.x.
 * That version merges `cookieOptions` and then FORCIBLY overwrites `maxAge`
 * with its own 400-day default on every cookie WRITE (see `setCookieOptions` in
 * `@supabase/ssr/dist/main/cookies.js`). We therefore also run every outgoing
 * cookie through `boundCookieMaxAge()` in each factory's `setAll`, which is the
 * part that actually takes effect. `cookieOptions` is still passed so the
 * intent is declared at the call site and so the bound applies automatically if
 * the library drops that override.
 */
export const SESSION_COOKIE_OPTIONS = {
  maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
} as const;

/**
 * Clamp a cookie's lifetime to {@link SESSION_COOKIE_MAX_AGE_SECONDS}.
 *
 * Generic in the options type so the caller's exact type survives (the three
 * factories hand the result straight to `cookieStore.set` / `document.cookie`,
 * which each want their own shape).
 *
 * Rules:
 *   - `maxAge <= 0` passes through untouched. That is a DELETION (the SDK
 *     expires stale chunks with `maxAge: 0`); clamping one up to 12h would
 *     resurrect a cookie the SDK is trying to remove.
 *   - A shorter `maxAge` than the cap is left alone — we only ever tighten.
 *   - An `expires` that would outlive the cap is dropped. `Max-Age` wins over
 *     `Expires` per RFC 6265 so it would not actually extend anything, but two
 *     attributes disagreeing about the same deadline is exactly the kind of
 *     thing that confuses a proxy or a future reader of this code.
 */
export function boundCookieMaxAge<
  T extends { maxAge?: number; expires?: Date },
>(options: T): T {
  const current = options.maxAge;

  // Deletion — leave it exactly as the SDK wrote it.
  if (typeof current === "number" && current <= 0) return options;

  const bounded =
    typeof current === "number" && Number.isFinite(current)
      ? Math.min(current, SESSION_COOKIE_MAX_AGE_SECONDS)
      : SESSION_COOKIE_MAX_AGE_SECONDS;

  const next: T = { ...options, maxAge: bounded };
  if (
    next.expires instanceof Date &&
    next.expires.getTime() > Date.now() + bounded * 1000
  ) {
    next.expires = undefined;
  }
  return next;
}

/** The subset of cookie attributes {@link serializeCookie} knows how to emit. */
export type SerializableCookieOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  secure?: boolean;
  partitioned?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  /** Accepted and deliberately IGNORED — see serializeCookie. */
  httpOnly?: boolean;
};

/**
 * Parse a `document.cookie` string into the `{ name, value }[]` shape the
 * Supabase browser client's `getAll` must return.
 *
 * Mirrors the `cookie` package's `parse` (which is what `@supabase/ssr` uses
 * for its own `document.cookie` fallback): values are URI-decoded, and a value
 * that will not decode is returned raw rather than throwing. First occurrence
 * of a name wins, matching that implementation.
 */
export function parseCookieHeader(
  header: string | null | undefined,
): { name: string; value: string }[] {
  if (!header) return [];
  const seen = new Set<string>();
  const out: { name: string; value: string }[] = [];
  for (const part of header.split(";")) {
    const pair = part.trim();
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const name = eq === -1 ? pair : pair.slice(0, eq).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const raw = eq === -1 ? "" : pair.slice(eq + 1).trim();
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // Not percent-encoded (or malformed) — keep the raw text, same as the
      // `cookie` package's default decoder does.
    }
    out.push({ name, value });
  }
  return out;
}

/**
 * Serialize one cookie for assignment to `document.cookie`.
 *
 * `httpOnly` is accepted but never emitted: `document.cookie` cannot set it
 * (the browser silently drops the attribute), and the Supabase browser client
 * has to be able to READ this cookie anyway.
 */
export function serializeCookie(
  name: string,
  value: string,
  options: SerializableCookieOptions = {},
): string {
  let out = `${name}=${encodeURIComponent(value)}`;
  if (typeof options.maxAge === "number" && Number.isFinite(options.maxAge)) {
    out += `; Max-Age=${Math.floor(options.maxAge)}`;
  }
  if (options.domain) out += `; Domain=${options.domain}`;
  out += `; Path=${options.path ?? "/"}`;
  if (options.expires instanceof Date) {
    out += `; Expires=${options.expires.toUTCString()}`;
  }
  const sameSite = options.sameSite;
  if (sameSite === true || sameSite === "strict") out += "; SameSite=Strict";
  else if (sameSite === "lax") out += "; SameSite=Lax";
  else if (sameSite === "none") out += "; SameSite=None";
  if (options.secure) out += "; Secure";
  if (options.partitioned) out += "; Partitioned";
  return out;
}
