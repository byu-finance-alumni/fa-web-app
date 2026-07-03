import { NextResponse, type NextRequest } from "next/server";
import { isPrefetchHeaders } from "@/lib/prefetch";
import { updateSession } from "@/utils/supabase/middleware";
import { buildCsp } from "@/lib/csp";

// Detects a Next.js <Link> prefetch (or any speculative fetch) so we can skip
// auth refresh/redirect for it. The detection logic lives in @/lib/prefetch as a
// pure function so it can be unit-tested (issue #31 regression).
function isPrefetch(request: NextRequest): boolean {
  return isPrefetchHeaders(request.headers);
}

export async function middleware(request: NextRequest) {
  // Per-request nonce-based CSP (#30): a fresh nonce so Next.js can nonce its
  // injected scripts and we can drop script-src 'unsafe-inline'. Threaded into
  // the forwarded request (so Next reads the nonce) AND set on the response (so
  // the browser enforces it) — both handled here and in updateSession.
  const { nonce, csp } = buildCsp();

  // Prefetch requests must NOT trigger the Supabase token refresh or the
  // redirect-to-login path. A prefetch runs the same middleware as a real
  // navigation, so near token expiry it would (a) rotate the single-use refresh
  // token server-side without the browser ever persisting the new cookie —
  // racing the next real request into "refresh_token_already_used" — and
  // (b) cache a `/login` redirect in the router cache, so a later Back nav
  // lands on login. Skipping updateSession for prefetch avoids both; the real
  // navigation that follows still runs full auth (refresh + redirect) below.
  if (isPrefetch(request)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("content-security-policy", csp);
    return response;
  }

  return await updateSession(request, { nonce, csp });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.webmanifest / robots.txt / sitemap.xml (public metadata files —
     *   the browser requests these without app cookies, so running auth on them
     *   bounced them to /login)
     * - branding/ (static brand assets in /public)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|branding|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
