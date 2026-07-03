/**
 * Content-Security-Policy builder for the nonce-based CSP (#30).
 *
 * A fresh per-request nonce lets us drop `unsafe-inline` from `script-src`:
 * every inline script Next.js injects (hydration/streaming bootstrap) carries
 * this nonce, and `strict-dynamic` extends that trust to the chunk scripts those
 * bootstrap scripts load — so an injected/XSS inline script (which can't guess
 * the nonce) is refused. `'self'` stays as a fallback for older browsers that
 * don't understand `strict-dynamic` (which those browsers use, ignoring it);
 * browsers that DO understand `strict-dynamic` ignore `'self'` and the (absent)
 * `unsafe-inline`.
 *
 * `style-src` deliberately keeps `unsafe-inline`: Next.js injects inline styles
 * without a nonce hook, and inline styles are a far weaker XSS vector than
 * scripts. Scoped to the origins the app actually talks to (self + Supabase +
 * the dev/prod API). `unsafe-eval` is added only in dev for Fast Refresh/HMR.
 *
 * Built in middleware (per request) rather than next.config headers (static), so
 * the nonce can change every request.
 */
export function buildCsp(): { nonce: string; csp: string } {
  // Web Crypto is available in both the Edge and Node middleware runtimes.
  const nonce = btoa(crypto.randomUUID());
  const isProd = process.env.NODE_ENV === "production";

  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fa-web-api.vercel.app https://dev-fa-web-api.vercel.app",
  ].join("; ");

  return { nonce, csp };
}
