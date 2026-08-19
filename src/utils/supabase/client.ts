import { createBrowserClient } from "@supabase/ssr";

import {
  SESSION_COOKIE_OPTIONS,
  boundCookieMaxAge,
  parseCookieHeader,
  serializeCookie,
} from "@/lib/sessionPolicy";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Browser-side Supabase client. Use in Client Components for auth flows
// (sign in/out, session). Do NOT use to read alumni data — that goes through
// the FastAPI backend (see CLAUDE.md → API Usage).
//
// SESSION LIFETIME (#684): the auth cookie is bound to 12 hours — see
// src/lib/sessionPolicy.ts for why that number, and for the Supabase dashboard
// settings that must be set separately on dev AND prod. All three client
// factories (this one, server.ts, middleware.ts) import the same constant; they
// MUST agree, because the last writer wins and a mismatch leaves the user in a
// confusing half-logged-in state.
//
// The explicit `cookies` adapter below replaces `@supabase/ssr`'s built-in
// `document.cookie` fallback for ONE reason: 0.10.3 force-overwrites `maxAge`
// with its own 400-day default on every write, so `cookieOptions` alone is a
// no-op. Routing writes through `boundCookieMaxAge` is what actually caps the
// browser-side token refreshes. The adapter mirrors the library's own fallback
// (`cookie.parse` / `cookie.serialize` over `document.cookie`) exactly, minus
// that override. `httpOnly` is untouched — it is false by necessity, since this
// client has to read the cookie back out of `document.cookie`.
export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        if (typeof document === "undefined") return [];
        return parseCookieHeader(document.cookie);
      },
      setAll(cookiesToSet) {
        if (typeof document === "undefined") return;
        cookiesToSet.forEach(({ name, value, options }) => {
          document.cookie = serializeCookie(
            name,
            value,
            boundCookieMaxAge(options),
          );
        });
      },
    },
  });
