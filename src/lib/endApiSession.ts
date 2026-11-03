"use client";

import { createClient } from "@/utils/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** How long sign-out waits on the API before carrying on without it. */
export const END_API_SESSION_TIMEOUT_MS = 3000;

/**
 * End this device's session on the API (`POST /auth/logout`) — call it right
 * BEFORE `supabase.auth.signOut()` on every sign-out path.
 *
 * Supabase's sign-out ends the refresh token, but the access token it already
 * issued is checked by signature alone and would keep working on the API until
 * it expires (~1 hour). This call makes the API refuse that token at once. It
 * must run first: after `signOut()` the token is no longer in the client to send.
 *
 * Best-effort by contract: it never throws and never waits longer than
 * {@link END_API_SESSION_TIMEOUT_MS}, so a slow or unreachable API can never
 * stop anyone signing out.
 */
export async function endApiSession(
  timeoutMs: number = END_API_SESSION_TIMEOUT_MS,
): Promise<void> {
  try {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        // Lets the request finish even as the page navigates away.
        keepalive: true,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* best-effort — sign-out continues regardless */
  }
}
