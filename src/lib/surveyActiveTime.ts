/**
 * How long an alum ACTIVELY spends filling the survey, measured on the client.
 *
 * "Active" means wall-time while the tab is VISIBLE: the timer runs from first
 * load and PAUSES on `document.visibilitychange` whenever the tab is hidden, so
 * "opened it, went to lunch, came back" does not inflate the number. It is read
 * once, at submit, and sent alongside the response (see `editSubmitBody`).
 *
 * BEST-EFFORT AND OPTIONAL. Nothing here may throw into the submit path: a clock
 * that jumps backwards yields no negative time, and if the value never makes it
 * (an old browser, a blocked timer) the submission works exactly as before. The
 * backend clamps and drops anything unreasonable — the number crossing the wire
 * is never trusted.
 *
 * The class is pure (an injectable `now`) so the accounting is unit-testable
 * without a DOM; the hook wires it to the page's visibility.
 */

import { useEffect, useRef } from "react";

/**
 * Accumulates active milliseconds across visible/hidden transitions.
 *
 * `start` begins (or resumes) a running interval; `pause` banks the interval
 * that was running and stops the clock. Both are idempotent — a second `start`
 * while already running, or a `pause` while already paused, is a no-op — so the
 * hook can call them from event handlers without tracking prior state itself.
 */
export class ActiveTimer {
  private accumulatedMs = 0;
  private runningSince: number | null = null;

  constructor(private readonly now: () => number = () => Date.now()) {}

  start(): void {
    if (this.runningSince === null) this.runningSince = this.now();
  }

  pause(): void {
    if (this.runningSince !== null) {
      // Clamp at 0: a backwards clock (NTP correction, manual change) must never
      // bank negative time, which would read as a faster-than-instant fill.
      this.accumulatedMs += Math.max(0, this.now() - this.runningSince);
      this.runningSince = null;
    }
  }

  /** Whole active seconds so far, banked plus the currently-running interval. */
  elapsedSeconds(): number {
    let ms = this.accumulatedMs;
    if (this.runningSince !== null) {
      ms += Math.max(0, this.now() - this.runningSince);
    }
    return Math.round(ms / 1000);
  }
}

/**
 * Wire an {@link ActiveTimer} to the current tab's visibility and return a
 * getter for the active seconds so far, to read at submit.
 *
 * Starts running on mount when the tab is visible, pauses when it is hidden and
 * resumes when it is shown again, and banks the final interval on unmount. The
 * timer survives re-renders (a ref), so an in-progress fill is never reset by
 * one. Returns a STABLE getter — call it at submit time to read the total.
 */
export function useActiveTimer(): () => number {
  const timerRef = useRef<ActiveTimer | null>(null);
  if (timerRef.current === null) timerRef.current = new ActiveTimer();

  useEffect(() => {
    const timer = timerRef.current!;
    // Only start if the page is actually in front of the alum — a survey opened
    // into a background tab should not tick until it is looked at.
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      timer.start();
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") timer.pause();
      else timer.start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      timer.pause();
    };
  }, []);

  return () => timerRef.current!.elapsedSeconds();
}
