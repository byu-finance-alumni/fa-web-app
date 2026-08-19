/**
 * Persistence for the idle-session timer (issue #684).
 *
 * THE PROBLEM
 * -----------
 * `SessionTimeout` holds its whole clock — `lastActivity` and the pending
 * `setTimeout` — inside a React effect. All of it is created on mount, so a
 * hard reload, a new tab, quitting the browser or restarting the machine puts
 * the idle countdown back to zero. Jake restarted his laptop, came back, and was
 * still signed in: the 15-minute idle timeout was not a control at all, it was
 * a screensaver for one tab. Cross-tab sync uses `BroadcastChannel`, which is
 * in-memory too, so it does not help either.
 *
 * THE FIX, AND WHAT IT IS NOT
 * ---------------------------
 * Write the last-activity timestamp to `localStorage`, and on mount decide from
 * that timestamp instead of starting the clock fresh. That makes the dialog
 * TELL THE TRUTH: if you were away for twenty minutes, you get signed out when
 * you come back, whether or not the tab survived.
 *
 * This is an HONESTY fix, not a hardening one. It is entirely client-side.
 * Anyone who can open devtools can clear `localStorage` and defeat it. That is
 * acceptable, and deliberate: the threat model here is an UNATTENDED MACHINE —
 * a logged-in laptop someone walks away from or a shared workstation — not a
 * hostile user who already has the session. The actual security boundary is the
 * Supabase server-side session settings (see `sessionPolicy.ts`) plus the
 * 12-hour cookie bound; this module is what makes the app's own behaviour match
 * what it tells the user it does.
 *
 * The functions here are deliberately pure (storage is injected) so the
 * decision logic can be tested without a DOM.
 */

/**
 * `localStorage` key holding the epoch-ms timestamp of the last user activity.
 * Namespaced so it cannot collide with anything else on the origin.
 */
export const LAST_ACTIVITY_STORAGE_KEY = "fa.session.lastActivityAt";

/**
 * Minimum gap between `localStorage` writes, in ms.
 *
 * Activity events include `mousemove` and `scroll`, which fire dozens of times
 * a second. Persisting on each one would be a synchronous storage write per
 * event — a real jank source. Fifteen seconds keeps the stored value accurate
 * to well within the 15-minute idle window while writing at most four times a
 * minute. The cost of the throttle is that the stored timestamp can lag real
 * activity by up to 15s, which makes the resumed timer slightly SHORTER than it
 * should be. Erring short is the correct direction: it can never extend a
 * session.
 */
export const ACTIVITY_PERSIST_INTERVAL_MS = 15_000;

/**
 * How far in the future a stored timestamp may be before we stop believing it.
 *
 * A few seconds of skew is normal (the clock ticking between a write and a
 * read, an NTP nudge). Anything beyond this is a clock that moved, and the
 * stored value tells us nothing usable.
 */
export const CLOCK_SKEW_TOLERANCE_MS = 5_000;

/** The slice of the Storage API this module needs. */
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/**
 * What `SessionTimeout` should do on mount, given the stored timestamp.
 *
 * - `sign-out` — the stored timestamp says the idle window already elapsed.
 *   The session must END. This is the whole point of the feature.
 * - `arm` — there was recent activity; arm the idle timer for the REMAINING
 *   window rather than a full one, so the countdown reflects real idle time.
 * - `start-fresh` — we have nothing trustworthy to go on. Behave exactly as the
 *   code did before this change: full idle window from now. Never a sign-out.
 */
export type IdleMountDecision =
  | { action: "start-fresh"; reason: "missing" | "corrupt" | "future" }
  | { action: "arm"; remainingMs: number; elapsedMs: number }
  | { action: "sign-out"; elapsedMs: number };

/**
 * `window.localStorage`, or `null` when it is unavailable. Access itself can
 * throw (Safari private browsing, storage disabled by policy, SSR), so it is
 * guarded — a browser without usable storage must still be able to use the app.
 */
export function getActivityStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Read the raw stored value, or `null` if absent/unreadable. */
export function readLastActivity(storage: StorageLike | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Write the timestamp unconditionally. Failures are swallowed. */
export function writeLastActivity(
  storage: StorageLike | null,
  at: number,
): void {
  if (!storage) return;
  try {
    storage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(at));
  } catch {
    // Quota / private mode / disabled storage. Losing persistence degrades us
    // to the old in-memory-only behaviour, which is survivable; throwing here
    // would take the whole app down.
  }
}

/**
 * Remove the stored timestamp. Called on every sign-out so the NEXT login
 * starts from a clean slate instead of inheriting the previous session's idle
 * age (which would sign the new session out immediately).
 */
export function clearLastActivity(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    // Best effort; see writeLastActivity.
  }
}

/**
 * Throttled write. Returns the timestamp of the most recent ACTUAL write, which
 * the caller feeds back in on the next call.
 *
 * Pass `lastWriteAt = 0` for "never written in this mount".
 */
export function persistActivity(
  storage: StorageLike | null,
  now: number,
  lastWriteAt: number,
): number {
  // `now < lastWriteAt` means the clock moved backwards. Falling through to the
  // write is what we want: a negative gap must not be read as "recently
  // written" and suppress every future write until the clock catches up.
  if (
    lastWriteAt > 0 &&
    now >= lastWriteAt &&
    now - lastWriteAt < ACTIVITY_PERSIST_INTERVAL_MS
  ) {
    return lastWriteAt;
  }
  writeLastActivity(storage, now);
  return now;
}

/**
 * Decide what to do on mount from the stored value.
 *
 * Every failure mode resolves to `start-fresh`, never to a sign-out:
 *   - missing    — nothing stored (first ever load, or a clean sign-out).
 *   - corrupt    — empty string, non-numeric, NaN, Infinity, or <= 0. A garbled
 *                  value must not be able to lock anyone out of the app; the
 *                  caller rewrites it, so the entry self-heals on first use.
 *   - future     — stored more than CLOCK_SKEW_TOLERANCE_MS ahead of `now`. The
 *                  system clock moved (a laptop resuming, a timezone/NTP jump,
 *                  or someone editing localStorage). We deliberately do NOT
 *                  compute a negative idle age — that would make the session
 *                  look infinitely fresh and keep someone signed in forever,
 *                  which is the one outcome worse than signing them out. We
 *                  also do not sign out on it: the value is simply unusable, so
 *                  we discard it and start a normal window. The caller
 *                  overwrites the bad value immediately, so the next load is
 *                  back to real enforcement.
 *
 * Within the skew tolerance a slightly-future timestamp is clamped to zero
 * elapsed rather than discarded, which is the same outcome with less churn.
 */
export function decideIdleOnMount({
  stored,
  now,
  idleMs,
}: {
  stored: string | null | undefined;
  now: number;
  idleMs: number;
}): IdleMountDecision {
  if (stored === null || stored === undefined) {
    return { action: "start-fresh", reason: "missing" };
  }

  const trimmed = stored.trim();
  if (trimmed === "") return { action: "start-fresh", reason: "corrupt" };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { action: "start-fresh", reason: "corrupt" };
  }

  if (parsed > now + CLOCK_SKEW_TOLERANCE_MS) {
    return { action: "start-fresh", reason: "future" };
  }

  const elapsedMs = Math.max(0, now - parsed);
  if (elapsedMs >= idleMs) return { action: "sign-out", elapsedMs };
  return { action: "arm", remainingMs: idleMs - elapsedMs, elapsedMs };
}
