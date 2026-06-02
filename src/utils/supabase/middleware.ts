import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Routes reachable without a session. Everything else requires auth.
// `/` is the public landing/marketing page; `/login` is the sign-in screen.
const PUBLIC_PATHS = ["/", "/login"];

// Where authenticated users land (and where `/login` redirects them).
const APP_HOME = "/dashboard";

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
export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token against Supabase and rotates
  // expiring cookies. Do not gate auth decisions on getSession() — it only
  // reads the (spoofable) cookie without verifying it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated user hitting a protected route → send to login, remembering
  // where they were headed so we can return them there after sign-in.
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);
    return withCookies(supabaseResponse, NextResponse.redirect(loginUrl));
  }

  // Already signed in but sitting on /login → bounce to the app.
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = APP_HOME;
    homeUrl.search = "";
    return withCookies(supabaseResponse, NextResponse.redirect(homeUrl));
  }

  return supabaseResponse;
};
