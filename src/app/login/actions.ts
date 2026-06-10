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
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase returns "Invalid login credentials" for both bad email and bad
    // password — keep it generic so we don't leak which accounts exist.
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message,
    };
  }

  // Invalidate the router/data cache for everything under the root layout so
  // the destination is rendered FRESH for the now-signed-in user, instead of
  // serving the cached logged-out render (which showed up as "empty until you
  // manually refresh"). This is the canonical Supabase App Router login step.
  revalidatePath("/", "layout");
  redirect(safeNext(next));
}
