"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { loginPathWithNext } from "@/lib/urlSafety";
import {
  clearLastActivity,
  decideIdleOnMount,
  getActivityStorage,
  persistActivity,
  readLastActivity,
  writeLastActivity,
} from "@/lib/idleSession";
import { Button } from "@/components/ui/button";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "wheel",
] as const;

/**
 * Idle session guard. After `idleMs` with no user activity it shows a warning
 * dialog with a `countdownMs` grace period; if the user doesn't click "stay
 * signed in" before it reaches zero, they are signed out.
 *
 * Activity AND the warning are synchronized across tabs via BroadcastChannel,
 * so an idle tab can't sign the user out while they're working in another, and
 * clicking "stay signed in" (or signing out) applies everywhere. While the
 * warning is open, local pointer/key activity is intentionally ignored — the
 * user must explicitly click to stay (genuine activity in another tab still
 * cancels it).
 *
 * Signing out carries the page the user was on to `/login` as `?next=`, the same
 * way the middleware does for a cold navigation, so "put me back where I was"
 * works however the session ended (#682). Each tab carries ITS OWN path, which
 * is what you want when the sign-out arrives over the channel from another tab.
 *
 * The last-activity timestamp is ALSO persisted to `localStorage` (#684), so the
 * idle window survives a reload, a new tab, and a browser or machine restart —
 * previously every one of those reset the clock to zero, which made the timeout
 * trivially bypassable by closing the lid. On mount we read that timestamp and
 * sign out immediately if the window has already elapsed. See
 * `@/lib/idleSession` for the decision rules and for why this is an honesty fix
 * (the app now behaves the way it says it does) rather than a hardening one
 * (localStorage is clearable by whoever owns the browser).
 *
 * Mounted once in the authenticated app layout, so it only runs for signed-in
 * users.
 */
export function SessionTimeout({
  idleMs = 15 * 60 * 1000,
  countdownMs = 30 * 1000,
}: {
  idleMs?: number;
  countdownMs?: number;
}) {
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(countdownMs / 1000));

  // Imperative handlers are wired up inside the effect; these refs let the JSX
  // buttons call them without re-subscribing the listeners on every render.
  const stayRef = useRef<() => void>(() => {});
  const leaveRef = useRef<() => void>(() => {});

  // The current path, held in a ref rather than an effect dependency. The effect
  // owns the idle timer, the countdown and the BroadcastChannel; adding pathname
  // to its deps would tear all three down and re-arm the idle clock on every
  // navigation — and would reset an open warning dialog mid-countdown.
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let phase: "active" | "warning" = "active";
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;
    let lastActivity = 0;
    let goodbye = false;
    // `localStorage` (or null when it's unavailable — private mode, disabled by
    // policy). Everything below degrades to the old in-memory-only behaviour
    // when it's null; a browser without storage must still be usable.
    const storage = getActivityStorage();
    // Epoch-ms of the most recent ACTUAL write, for the write throttle. 0 = not
    // yet written in this mount.
    let lastPersistedAt = 0;
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("fa-session")
        : null;

    const clearIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = undefined;
    };
    const clearTick = () => {
      if (tick) clearInterval(tick);
      tick = undefined;
    };

    // Record activity as "now" and stamp the persistence throttle, for the
    // moments we want written through immediately rather than throttled (mount
    // with nothing usable stored, and "stay signed in").
    const markActiveNow = (now: number) => {
      writeLastActivity(storage, now);
      lastPersistedAt = now;
    };

    const signOut = async () => {
      if (goodbye) return;
      goodbye = true;
      clearIdle();
      clearTick();
      // Drop the stored timestamp so the NEXT login starts clean instead of
      // inheriting this session's idle age and being bounced straight back out.
      clearLastActivity(storage);
      channel?.postMessage({ t: "logout" });
      try {
        await createClient().auth.signOut();
      } finally {
        // Refresh so the middleware re-evaluates the (now empty) session.
        router.replace(loginPathWithNext(pathRef.current, { reason: "timeout" }));
        router.refresh();
      }
    };

    const openWarning = (deadline?: number) => {
      if (phase === "warning") return;
      phase = "warning";
      clearIdle();
      const end = deadline ?? Date.now() + countdownMs;
      // The tab that hits the idle limit first broadcasts the shared deadline so
      // every tab shows the same countdown.
      if (deadline === undefined) channel?.postMessage({ t: "warn", end });
      setWarning(true);
      setSecondsLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
      clearTick();
      tick = setInterval(() => {
        const ms = end - Date.now();
        if (ms <= 0) {
          clearTick();
          void signOut();
          return;
        }
        setSecondsLeft(Math.ceil(ms / 1000));
      }, 250);
    };

    const armIdle = () => {
      clearIdle();
      idleTimer = setTimeout(() => openWarning(), idleMs);
    };

    const resume = (broadcast: boolean) => {
      phase = "active";
      clearTick();
      setWarning(false);
      // "Stay signed in" is explicit activity, so write it through rather than
      // waiting on the throttle — otherwise a reload seconds later would still
      // read a stale, nearly-expired timestamp and sign the user out.
      markActiveNow(Date.now());
      armIdle();
      if (broadcast) channel?.postMessage({ t: "resume" });
    };

    const stay = async () => {
      // Confirm the session is still valid (and refresh the token) before
      // resuming. If it's gone, the next request / middleware will bounce us.
      try {
        await createClient().auth.getUser();
      } catch {
        // ignore network/refresh errors here
      }
      resume(true);
    };

    const onActivity = () => {
      if (phase !== "active") return; // during the warning only the button counts
      const now = Date.now();
      if (now - lastActivity < 1000) return; // throttle to at most one reset/sec
      lastActivity = now;
      armIdle();
      // Persist on its OWN, much coarser throttle (see
      // ACTIVITY_PERSIST_INTERVAL_MS). mousemove/scroll fire dozens of times a
      // second; even the 1/sec gate above would mean a synchronous storage
      // write every second for as long as someone is working.
      lastPersistedAt = persistActivity(storage, now, lastPersistedAt);
      channel?.postMessage({ t: "active" });
    };

    if (channel) {
      channel.onmessage = (e: MessageEvent) => {
        const m = e.data as { t?: string; end?: number };
        if (m?.t === "active") {
          if (phase === "active") armIdle();
        } else if (m?.t === "warn") {
          openWarning(m.end);
        } else if (m?.t === "resume") {
          resume(false);
        } else if (m?.t === "logout" && !goodbye) {
          goodbye = true;
          clearIdle();
          clearTick();
          // The tab that initiated the sign-out already cleared this, but it
          // may have been torn down mid-flight; clearing again is idempotent
          // and guarantees the next login starts clean.
          clearLastActivity(storage);
          router.replace(
            loginPathWithNext(pathRef.current, { reason: "timeout" }),
          );
          router.refresh();
        }
      };
    }

    stayRef.current = () => void stay();
    leaveRef.current = () => void signOut();

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true }),
    );

    // ---- Mount: pick up where the last page load left off (#684) ------------
    // This replaces a bare `armIdle()`, which handed every fresh page load a
    // full, untouched idle window — the bug: reload, new tab, browser restart
    // or machine restart all reset the timeout to zero.
    //
    //   expired  -> sign out NOW. If the stored timestamp says the window has
    //               already elapsed, the session ends. No grace dialog: the
    //               grace period is a warning to someone who is AT the screen,
    //               and by definition nobody was.
    //   fresh    -> arm for the REMAINING window, not a full one. Mounting is
    //               not itself activity (a restored tab needs no interaction),
    //               so we must not silently top the clock back up — that would
    //               reintroduce the bypass one reload at a time. The stored
    //               value is left alone; the first real event rewrites it.
    //   missing /
    //   corrupt /
    //   future   -> start a normal full window and write a good timestamp, so
    //               the entry self-heals. Never a sign-out: an unreadable value
    //               must not be able to lock anyone out.
    const mountedAt = Date.now();
    const decision = decideIdleOnMount({
      stored: readLastActivity(storage),
      now: mountedAt,
      idleMs,
    });
    if (decision.action === "sign-out") {
      void signOut();
    } else if (decision.action === "arm") {
      // Keep the throttle honest: treat the stored write as the last one, so
      // the next real activity persists promptly instead of waiting out a fresh
      // interval from mount.
      lastPersistedAt = mountedAt - decision.elapsedMs;
      clearIdle();
      idleTimer = setTimeout(() => openWarning(), decision.remainingMs);
    } else {
      markActiveNow(mountedAt);
      armIdle();
    }

    return () => {
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, onActivity),
      );
      clearIdle();
      clearTick();
      channel?.close();
    };
  }, [idleMs, countdownMs, router]);

  if (!warning) return null;

  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
    >
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
        <h2
          id="session-timeout-title"
          className="text-lg font-semibold text-gray-900"
        >
          Your session is about to expire
        </h2>
        <p id="session-timeout-desc" className="mt-2 text-sm text-gray-600">
          For your security, you&apos;ll be automatically signed out due to
          inactivity in{" "}
          <span className="font-semibold tabular-nums text-gray-900">
            {clock}
          </span>
          .
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            autoFocus
            onClick={() => stayRef.current()}
            className="w-full"
          >
            Stay signed in
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => leaveRef.current()}
            className="w-full text-gray-500 hover:text-gray-700"
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
