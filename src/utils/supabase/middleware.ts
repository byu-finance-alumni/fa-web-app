import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { APP_HOME, isReturnablePath } from "@/lib/urlSafety";
import { SESSION_COOKIE_OPTIONS, boundCookieMaxAge } from "@/lib/sessionPolicy";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Routes reachable without a session. Everything else requires auth.
// `/` is the public landing/marketing page; `/login` is the sign-in screen;
// `/maintenance` is the site-down page — it MUST be public, since maintenance
// mode signs everyone out and the whole point is that a logged-out visitor can
// see why. `/login` staying public is equally load-bearing: engineers are exempt
// from the maintenance pause and sign in through it to turn maintenance off.
const PUBLIC_PATHS = ["/", "/login", "/maintenance"];

// Where authenticated users land (and where `/login` redirects them) is
// APP_HOME, imported from @/lib/urlSafety — the same constant the login action
// falls back to when a `?next=` can't be honoured, so the two can't drift.

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

// Carries the session cookies Supabase rotated onto a fresh response (e.g. a
// redirect), so refreshing a token and redirecting in the same request don't
// drop the updated cookies.
function withCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

// Refreshes the user's auth session on every matched request, syncs rotated
// cookies onto the response, and enforces route protection:
//   - unauthenticated + protected route  → redirect to /login (with ?next=)
//   - authenticated + on /login          → redirect to the app home
// Called from the root middleware.
export const updateSession = async (
  request: NextRequest,
  // Nonce-based CSP (#30). When present, the nonce is threaded onto the
  // FORWARDED request headers (so Next.js reads it and nonces its scripts) and
  // the CSP is set on every response the browser receives (so it's enforced).
  csp?: { nonce: string; csp: string },
) => {
  // Forwarded request headers = the incoming headers (including any cookies
  // Supabase just rotated onto `request`) plus the CSP nonce. Rebuilt each time
  // so the freshly-set cookies AND the nonce reach the server render.
  const forwardHeaders = () => {
    const headers = new Headers(request.headers);
    if (csp) {
      headers.set("x-nonce", csp.nonce);
      headers.set("content-security-policy", csp.csp);
    }
    return headers;
  };
  const withCsp = (response: NextResponse) => {
    if (csp) response.headers.set("content-security-policy", csp.csp);
    return response;
  };

  let supabaseResponse = NextResponse.next({
    request: { headers: forwardHeaders() },
  });

  // SESSION LIFETIME (#684): the auth cookie is bound to 12 hours — see
  // src/lib/sessionPolicy.ts for why that number, and for the Supabase
  // dashboard settings that must be set separately on dev AND prod. All three
  // client factories (client.ts, server.ts, this one) import the same constant
  // and must agree. This one matters most: the middleware refreshes the token on
  // every matched request, so it rewrites the auth cookie constantly. If it
  // alone kept the library default, every navigation would silently reset the
  // lifetime back to 400 days and undo the bound set everywhere else.
  //
  // `cookieOptions` declares the intent; `boundCookieMaxAge` in `setAll` is what
  // enforces it, because @supabase/ssr 0.10.3 overwrites `maxAge` with its own
  // 400-day default on every write. Deletions (`maxAge: 0`) pass through
  // untouched, and `httpOnly` / `sameSite` / `secure` are left as the library
  // set them.
  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request: { headers: forwardHeaders() },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, boundCookieMaxAge(options)),
        );
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token against Supabase and rotates
  // expiring cookies. Do not gate auth decisions on getSession() — it only
  // reads the (spoofable) cookie without verifying it.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;

  const { pathname } = request.nextUrl;

  // Distinguish "definitely signed out" from "couldn't verify right now". A
  // transient getUser() failure (Supabase 5xx/timeout, network blip, or a
  // token-refresh race moments after a token rotated) returns no user PLUS an
  // error, while the browser is still holding valid session cookies. Treating
  // that as logged-out bounced authenticated users to /login?next= mid-navigation
  // (E7: intermittent 307 → /login on /admin/vocabulary and /alumni). Fail SAFE:
  // only treat it as a real sign-out when the auth server gives a definitive
  // auth verdict — a missing session (AuthSessionMissingError, 400) or a rejected
  // token (401/403). A 5xx or a transport error (status 0/undefined) means we
  // simply couldn't reach Supabase to verify a session that may well be valid,
  // so we let the request through; the page's own getSession()/backend stay the
  // source of truth and the next request retries the refresh. A spoofed cookie
  // can't gain access here — protected pages and the backend re-verify the token
  // regardless, so failing open at the middleware is safe.
  const hasSessionCookies = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const status = userError?.status ?? 0;
  const isDefinitiveAuthFailure = status === 400 || status === 401 || status === 403;
  const verificationFailedButMaybeAuthed =
    !user && userError != null && !isDefinitiveAuthFailure && hasSessionCookies;

  // Unauthenticated user hitting a protected route → send to login, remembering
  // where they were headed so we can return them there after sign-in. A
  // transient verification failure (above) is NOT treated as unauthenticated.
  if (!user && !verificationFailedButMaybeAuthed && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // `pathname` came off a parsed NextURL so it is already a real path, but it
    // still goes through the shared gate: the login action honours `next` only
    // when isReturnablePath agrees, so emitting one it would drop would put a
    // promise in the address bar that the other end silently breaks.
    if (isReturnablePath(pathname)) loginUrl.searchParams.set("next", pathname);
    return withCsp(withCookies(supabaseResponse, NextResponse.redirect(loginUrl)));
  }

  // Already signed in but sitting on /login → bounce to the app.
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = APP_HOME;
    homeUrl.search = "";
    return withCsp(withCookies(supabaseResponse, NextResponse.redirect(homeUrl)));
  }

  return withCsp(supabaseResponse);
};
