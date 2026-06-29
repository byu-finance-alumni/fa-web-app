// Content-Security-Policy builder (issue #30).
//
// The script-src directive is nonce-based with 'strict-dynamic': only scripts
// carrying this request's nonce (and scripts they dynamically load) may execute.
// This drops 'unsafe-inline' from script-src for real XSS protection. We follow
// the official Next.js "Content Security Policy" guide:
//   - 'strict-dynamic' trusts scripts loaded by an already-trusted (nonced)
//     script, so we don't have to enumerate every chunk URL.
//   - 'unsafe-inline' is kept in the directive ONLY as a fallback that
//     CSP3-capable browsers IGNORE when a nonce/'strict-dynamic' is present, so
//     it provides no real allowance there; legacy browsers without nonce support
//     fall back to it. 'https:' is the same kind of legacy fallback.
//   - 'unsafe-eval' is added in development only because React Fast Refresh / HMR
//     evaluate strings as JavaScript. It is never emitted in production.
//
// style-src keeps 'unsafe-inline' deliberately: Tailwind and various component
// libraries inject inline <style>/style="" at runtime, and there is no nonce
// plumbing for styles. This issue (#30) is specifically about script-src.

const isProd = process.env.NODE_ENV === "production";

export function buildCsp(nonce: string): string {
  const scriptSrc = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Legacy fallbacks (ignored by CSP3 browsers when a nonce is present):
    "https:",
    "'unsafe-inline'",
    // HMR / Fast Refresh evaluates strings in dev only:
    ...(isProd ? [] : ["'unsafe-eval'"]),
  ].join(" ");

  return [
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
}
