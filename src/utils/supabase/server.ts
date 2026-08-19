import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SESSION_COOKIE_OPTIONS, boundCookieMaxAge } from "@/lib/sessionPolicy";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Server-side Supabase client for Server Components, Route Handlers, and
// Server Actions. Pass the cookie store from `await cookies()`.
//
// SESSION LIFETIME (#684): the auth cookie is bound to 12 hours — see
// src/lib/sessionPolicy.ts for why that number, and for the Supabase dashboard
// settings that must be set separately on dev AND prod. All three client
// factories (client.ts, this one, middleware.ts) import the same constant and
// must agree; a mismatch means whichever writes last silently wins.
//
// `cookieOptions` declares the intent, but `boundCookieMaxAge` in `setAll` is
// what actually enforces it: @supabase/ssr 0.10.3 overwrites `maxAge` with its
// own 400-day default on every cookie write. Deletions (`maxAge: 0`) pass
// through untouched. `httpOnly`, `sameSite` and `secure` are left exactly as
// the library set them.
export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, boundCookieMaxAge(options)),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};
