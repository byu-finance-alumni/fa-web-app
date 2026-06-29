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

// Generates a fresh, cryptographically-random base64 nonce per request. Used to
// authorize this request's inline scripts under the nonce-based CSP (issue #30),
// so we can drop 'unsafe-inline' from script-src. Edge runtime exposes Web Crypto.
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // btoa is available in the Edge runtime; encode the raw bytes to base64.
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function middleware(request: NextRequest) {
  // Per-request nonce + CSP (issue #30). Forward the nonce to the app via the
  // `x-nonce` request header — Next.js reads it automatically and stamps it onto
  // its own framework <script> tags, and Server Components can read it from
  // headers() to nonce any first-party inline scripts. The CSP response header
  // is the source of truth (next.config.mjs no longer sets script-src).
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // Set the nonce on the *request* headers so it forwards into the React render.
  request.headers.set("x-nonce", nonce);

  // Helper: stamp the CSP onto whatever response the pipeline returns.
  const withCsp = (response: NextResponse): NextResponse => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  // Prefetch requests must NOT trigger the Supabase token refresh or the
  // redirect-to-login path. A prefetch runs the same middleware as a real
  // navigation, so near token expiry it would (a) rotate the single-use refresh
  // token server-side without the browser ever persisting the new cookie —
  // racing the next real request into "refresh_token_already_used" — and
  // (b) cache a `/login` redirect in the router cache, so a later Back nav
  // lands on login. Skipping updateSession for prefetch avoids both; the real
  // navigation that follows still runs full auth (refresh + redirect) below.
  if (isPrefetch(request)) {
    return withCsp(NextResponse.next({ request: { headers: request.headers } }));
  }

  return withCsp(await updateSession(request));
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
