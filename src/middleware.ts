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

// Paths that run the middleware WITHOUT any auth: no Supabase client, no
// getUser(), no redirect to /login. Only `/survey/*` — the public "confirm your
// info" landing page alumni open straight from an email link, with no session.
//
// It used to be excluded from the matcher entirely for exactly that reason,
// which worked but also dropped its CSP: the nonce-based policy is only ever
// built here in middleware (next.config.mjs deliberately sets none, since a
// second CSP would break the nonce), so the one public page in the app — the
// one that renders alumni PII, accepts edits and takes a photo upload — shipped
// with no Content-Security-Policy at all (#666). It now runs the middleware and
// gets the CSP; "public" is enforced here instead, by returning before
// updateSession is ever called.
//
// Distinct from `PUBLIC_PATHS` in @/utils/supabase/middleware: those (`/`,
// `/login`, `/maintenance`) still RUN auth, they just aren't redirected away
// from when signed out. These skip auth altogether.
export function isNoAuthPath(pathname: string): boolean {
  return pathname === "/survey" || pathname.startsWith("/survey/");
}

// A response carrying the nonce-based CSP and nothing else. The nonce goes on
// the FORWARDED request headers (so Next.js reads it and stamps it onto the
// inline scripts it injects) and the CSP goes on the response (so the browser
// enforces it) — the same two-sided threading updateSession does, kept identical
// so a page served this way hydrates exactly like an authenticated one.
function cspOnly(
  request: NextRequest,
  { nonce, csp }: { nonce: string; csp: string },
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
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
    return cspOnly(request, { nonce, csp });
  }

  // Public page (see isNoAuthPath): CSP only, auth never runs.
  if (isNoAuthPath(request.nextUrl.pathname)) {
    const response = cspOnly(request, { nonce, csp });
    // A survey link is a signed token in the URL, so a live one pasted into a
    // public place must not end up in a search index. Set as a header rather
    // than `robots` page metadata because the survey page is a Client Component,
    // which can't export metadata.
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
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
     * These are all non-document responses (assets, JSON, plain text), so they
     * need no Content-Security-Policy. `survey/` used to be excluded here too
     * and must NOT be re-added: it IS a document, and excluding it left it with
     * no CSP (#666). It is handled above as a public path instead.
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|branding|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
