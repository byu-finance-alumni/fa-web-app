"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { currentReturnPath, loginPathWithNext } from "@/lib/urlSafety";
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
 * Signing out carries the page the user was on to `/login` as `?next=` — query
 * string included, so a filtered list comes back filtered (#791) — the same way
 * the middleware does for a cold navigation, so "put me back where I was" works
 * however the session ended (#682). Each tab reads its OWN `window.location`,
 * which is what you want when the sign-out arrives over the channel from
 * another tab.
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

  // The return path is read from `window.location` at the moment of the
  // redirect (see currentReturnPath) rather than held as an effect dependency.
  // The effect owns the idle timer, the countdown and the BroadcastChannel;
  // depending on the URL would tear all three down and re-arm the idle clock on
  // every navigation — and would reset an open warning dialog mid-countdown.

  useEffect(() => {
    let phase: "active" | "warning" = "active";
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;
    let lastActivity = 0;
    let goodbye = false;
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

    const signOut = async () => {
      if (goodbye) return;
      goodbye = true;
      clearIdle();
      clearTick();
      channel?.postMessage({ t: "logout" });
      try {
        await createClient().auth.signOut();
      } finally {
        // Refresh so the middleware re-evaluates the (now empty) session.
        router.replace(
          loginPathWithNext(currentReturnPath(), { reason: "timeout" }),
        );
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
          router.replace(
            loginPathWithNext(currentReturnPath(), { reason: "timeout" }),
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
    armIdle();

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
