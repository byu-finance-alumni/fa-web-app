/**
 * Speculative-request (prefetch) detection.
 *
 * Pulled out of `src/middleware.ts` as a pure function of request headers so the
 * back-button-logout regression (issue #31) can be unit-tested without booting
 * the Next runtime. A prefetch must NOT trigger the Supabase token refresh /
 * redirect in the middleware: it runs the same middleware as a real navigation,
 * so near token expiry it would rotate the single-use refresh token server-side
 * without the browser ever persisting the new cookie (racing the next real
 * request into `refresh_token_already_used`) AND could cache a `/login` redirect
 * in the router cache that a later Back navigation lands on.
 *
 * Detects: Next.js App Router `<Link>` prefetches (`next-router-prefetch`) and
 * browser speculative fetches advertised via `purpose`/`sec-purpose`.
 */
export function isPrefetchHeaders(headers: Headers): boolean {
  return (
    headers.get("next-router-prefetch") !== null ||
    headers.get("purpose") === "prefetch" ||
    headers.get("sec-purpose")?.includes("prefetch") === true
  );
}
