"use server";

import { cookies, headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

// Only allow same-origin relative paths as the post-login redirect, so a
// crafted `?next=` can't bounce the user to an external site.
function safeNext(next: string | null | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

// Single GENERIC message for BOTH the cooldown and the locked states. We never
// reveal which one applies — distinguishing "wait a bit" from "fully locked"
// would tell an attacker whether an account exists / is under attack, which is
// an enumeration oracle. The wait-or-contact-admin wording covers both.
const LOCKOUT_MESSAGE =
  "Too many failed attempts. Please wait a few minutes and try again, or contact an administrator if you remain locked out.";

/**
 * Ask the backend whether this email is currently allowed to attempt a login.
 * Returns `true` when the attempt may proceed, `false` when it's in cooldown or
 * locked.
 *
 * FAIL-OPEN: any network error / non-OK response / malformed body logs
 * server-side and returns `true`. A hiccup in the lockout service must never
 * stop a legitimate user from signing in.
 */
async function loginPrecheckAllowed(email: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/login/precheck`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.error("[login] precheck non-OK:", res.status);
      return true; // fail open
    }
    const data = (await res.json()) as { allowed?: boolean };
    // Treat only an explicit `allowed === false` as a block; anything else
    // (missing/garbled field) fails open.
    return data?.allowed !== false;
  } catch (e) {
    console.error("[login] precheck error (failing open):", e);
    return true; // fail open
  }
}

/**
 * The client IP + IP-based location for the CURRENT request. Readable only in a
 * server action (the edge sees the real client; the backend call is server→
 * server). Prefers Vercel's trusted, edge-set IP headers over the spoofable
 * leftmost x-forwarded-for hop. All fields best-effort → null when absent (local
 * dev / non-Vercel), and clipped to the backend column limits so an odd value
 * never 422s the record.
 */
async function readLoginContext(): Promise<{
  ip_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}> {
  const h = await headers();
  const clip = (v: string | null, n: number) => (v ? v.slice(0, n) : null);
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v); // x-vercel-ip-city is URL-encoded
    } catch {
      return v;
    }
  };
  const xff = h.get("x-forwarded-for");
  const xffLast = xff
    ? (xff.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? null)
    : null;
  const ip = h.get("x-real-ip") ?? h.get("x-vercel-forwarded-for") ?? xffLast;
  return {
    ip_address: clip(ip ?? null, 64),
    city: clip(decode(h.get("x-vercel-ip-city")), 128),
    region: clip(h.get("x-vercel-ip-country-region"), 128),
    country: clip(h.get("x-vercel-ip-country"), 64),
  };
}

/**
 * Record the outcome of a login attempt so the backend can count failures and
 * arm the lockout. Fire-and-forget from the caller's perspective: FAIL-OPEN, so
 * a failure here is logged and swallowed (we never block the success path on the
 * recorder).
 *
 * On a FAILURE we also forward the client IP/geo context and the coarse Supabase
 * error `reason` — the backend logs one `login_failures` row (the engineer
 * Login-failures tab). Sending them on success is harmless (the backend ignores
 * a success here). `reason` stays coarse (an error code, never the message /
 * email) so the log can't leak PII, matching the generic message we show.
 */
async function recordLoginAttempt(
  email: string,
  success: boolean,
  reason?: string,
): Promise<void> {
  try {
    const context = await readLoginContext();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/login/record`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, success, context, reason }),
        cache: "no-store",
      },
    );
    if (!res.ok) console.error("[login] record non-OK:", res.status);
  } catch (e) {
    console.error("[login] record error (ignored):", e);
  }
}

/**
 * Record a SUCCESSFUL sign-in on the backend (stamps `users.last_login_at` and
 * appends to the login history shown on the engineer Logins tab). Logins happen
 * here in the server action, so this is the one precise "a real login just
 * happened" signal — fired exactly once per credential sign-in, not on every
 * token refresh.
 *
 * Best-effort / FAIL-OPEN: the post-login redirect must never hinge on this, so
 * any error is logged and swallowed. Authenticated with the freshly-issued
 * access token (passed in, since the session cookie isn't committed to the
 * cookie store yet at this point in the request).
 */
async function recordLoginSuccess(accessToken: string): Promise<void> {
  try {
    // Same client IP + location as the failure path, read from this request's
    // edge headers (see readLoginContext).
    const context = await readLoginContext();

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context),
      cache: "no-store",
    });
    if (!res.ok) console.error("[login] record-success non-OK:", res.status);
  } catch (e) {
    console.error("[login] record-success error (ignored):", e);
  }
}

/**
 * Server-side password sign-in. Doing this in a Server Action (rather than the
 * browser client) is what makes the post-login load reliable: the Supabase
 * server client writes the auth cookies onto THIS response synchronously, and
 * the redirect's request carries them — so the destination renders with a valid
 * session on the very first load. The browser client, by contrast, flushes its
 * cookie asynchronously after sign-in resolves, which raced every client-side
 * navigation and left the page empty until a manual refresh.
 *
 * Returns `{ error }` on bad credentials; on success it redirects (never
 * returns normally).
 */
export async function signIn(
  email: string,
  password: string,
  next?: string,
): Promise<{ error: string } | undefined> {
  // BEFORE attempting the password sign-in, check the lockout service. If the
  // account is in cooldown or locked, stop here with the generic message — we
  // don't even hit Supabase. Fails open (see helper) so a service hiccup never
  // blocks a real user.
  if (!(await loginPrecheckAllowed(email))) {
    return { error: LOCKOUT_MESSAGE };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Record the attempt outcome so the backend can arm/clear the lockout. On a
  // failure, forward the coarse Supabase error code as the reason (never the
  // message/email) so the login_failures log stays PII-free. `success` is simply
  // "no auth error". Fail-open: errors are swallowed inside.
  await recordLoginAttempt(email, !error, error?.code ?? undefined);

  if (error) {
    // Return ONE generic message for every auth failure so the response can't
    // be used to enumerate accounts or confirm email state. Supabase emits
    // distinct strings ("Invalid login credentials", "Email not confirmed",
    // "User is banned", rate-limit messages, …); surfacing any of them verbatim
    // is an account-enumeration oracle. Log the real reason server-side only.
    // Log ONLY the short error code (e.g. "invalid_credentials") — never
    // error.message, which can echo the submitted email into Vercel logs.
    console.error("[login] auth error:", error.code ?? "unknown_code");
    return { error: "Incorrect email or password." };
  }

  // Record the successful sign-in (last_login_at + login history). Best-effort:
  // read the just-issued token from the in-memory session (the cookie isn't in
  // the store yet) and fire the authenticated record call. Never blocks login —
  // recordLoginSuccess swallows its own errors, and we only attempt it when a
  // token is present.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    await recordLoginSuccess(session.access_token);
  }

  // Invalidate the router/data cache for everything under the root layout so
  // the destination is rendered FRESH for the now-signed-in user, instead of
  // serving the cached logged-out render (which showed up as "empty until you
  // manually refresh"). This is the canonical Supabase App Router login step.
  revalidatePath("/", "layout");
  // REPLACE, not push: inside a Server Action `redirect()` defaults to push,
  // which leaves `/login` as the previous history entry. Pressing Back then
  // restores the cached login paint from bfcache (a visible flash) before the
  // middleware re-redirects an authenticated user to the app (issue #31).
  // Replacing drops `/login` from history so Back never returns to it.
  redirect(safeNext(next), RedirectType.replace);
}
