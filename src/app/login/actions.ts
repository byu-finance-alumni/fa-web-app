"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
 * Record the outcome of a login attempt so the backend can count failures and
 * arm the lockout. Fire-and-forget from the caller's perspective: FAIL-OPEN, so
 * a failure here is logged and swallowed (we never block the success path on the
 * recorder).
 */
async function recordLoginAttempt(
  email: string,
  success: boolean,
): Promise<void> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/login/record`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, success }),
        cache: "no-store",
      },
    );
    if (!res.ok) console.error("[login] record non-OK:", res.status);
  } catch (e) {
    console.error("[login] record error (ignored):", e);
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

  // Record the attempt outcome so the backend can arm/clear the lockout.
  // `success` is simply "no auth error". Fail-open: errors are swallowed inside.
  await recordLoginAttempt(email, !error);

  if (error) {
    // Return ONE generic message for every auth failure so the response can't
    // be used to enumerate accounts or confirm email state. Supabase emits
    // distinct strings ("Invalid login credentials", "Email not confirmed",
    // "User is banned", rate-limit messages, …); surfacing any of them verbatim
    // is an account-enumeration oracle. Log the real reason server-side only.
    console.error("[login] auth error:", error.code ?? error.message);
    return { error: "Incorrect email or password." };
  }

  // Invalidate the router/data cache for everything under the root layout so
  // the destination is rendered FRESH for the now-signed-in user, instead of
  // serving the cached logged-out render (which showed up as "empty until you
  // manually refresh"). This is the canonical Supabase App Router login step.
  revalidatePath("/", "layout");
  redirect(safeNext(next));
}
