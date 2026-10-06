"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ApiClientError, clientGet } from "@/lib/api-client";
import { isAccountLocked } from "@/lib/accountLocked";
import { currentReturnPath, loginPathWithNext } from "@/lib/urlSafety";

// How often to ask the backend "is this still the account's active session?".
// Short enough that a superseded device is signed out promptly, long enough to
// be negligible load for an internal tool. Also re-checked on tab focus.
const POLL_MS = 20_000;

/**
 * Enforces one active session per account on the client (#147). The backend is
 * the source of truth — a newer sign-in claims the account's active session and
 * every data route rejects the older one — but a device that's just sitting idle
 * wouldn't notice until its next request. This poller asks
 * `GET /auth/session/active` on an interval (and on tab focus); when the backend
 * says this session was superseded, it signs the device out and sends it to the
 * login page with an explanatory notice — carrying the page they were on as
 * `?next=`, query string and all, exactly as the middleware does for a cold
 * navigation (#682, #791).
 *
 * It also ends a HARD-LOCKED account's session. Once an account is locked the
 * backend answers every authenticated route with 403 / `account_locked`, this
 * poll included; the device is signed out and sent to /login, where any sign-in
 * attempt gets the generic lockout message. Without this a locked user would
 * sit on pages that 403 everything until their token expired.
 *
 * Renders nothing. Mounted once in the app shell layout.
 */
export function SessionGuard() {
  const router = useRouter();
  const kicked = useRef(false);

  // The return path is read from `window.location` at the moment of the
  // redirect (see currentReturnPath), not tracked in React state: the effect
  // owns a long-lived interval and listeners, and a dependency on the URL would
  // restart the poll clock on every navigation.

  useEffect(() => {
    let cancelled = false;

    async function signOutTo(path: string) {
      kicked.current = true;
      try {
        await createClient().auth.signOut();
      } catch {
        /* best-effort — redirect regardless */
      }
      router.replace(path);
    }

    async function check() {
      if (cancelled || kicked.current) return;
      try {
        const { active } = await clientGet<{ active: boolean }>(
          "/auth/session/active",
        );
        if (active || cancelled || kicked.current) return;
        // Superseded: sign out locally and bounce to login with the reason.
        await signOutTo(
          loginPathWithNext(currentReturnPath(), {
            signedout: "other-device",
          }),
        );
      } catch (e) {
        // Hard-locked account: the session is dead on every route, so end it
        // here. Plain /login — no notice, no `next`: the sign-in screen's
        // generic lockout message is the only explanation the account gets.
        if (
          e instanceof ApiClientError &&
          isAccountLocked(e.status, e.code) &&
          !cancelled &&
          !kicked.current
        ) {
          await signOutTo("/login");
          return;
        }
        // Transient/network/auth error — ignore and retry next tick. A truly
        // expired session is handled by the middleware / SessionTimeout.
      }
    }

    const id = setInterval(check, POLL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    // An initial check on mount catches a device that returns to a background
    // tab after being superseded.
    void check();

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [router]);

  return null;
}
