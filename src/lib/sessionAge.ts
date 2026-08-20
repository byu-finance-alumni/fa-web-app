/**
 * How old a live session is, and how loudly to say so.
 *
 * The Sessions screen exists because Supabase sessions run for up to 400 days
 * by default and the app's idle timeout is browser-memory only (api #684) — so
 * a session opened weeks ago is still a live credential. A five-week-old row
 * that renders as an ordinary timestamp defeats the whole point of the screen,
 * so age gets its own column AND its own tone.
 *
 * Kept here, as pure functions, so the thresholds are testable without a DOM
 * (the suite runs in node) and so the table and the confirm dialog can never
 * describe the same session differently.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Anything older than this has outlived a working week of continuous use. */
export const STALE_AFTER_SECONDS = WEEK;
/** Anything older than this was not opened today. */
export const WATCH_AFTER_SECONDS = DAY;

export type SessionTone = "fresh" | "watch" | "stale";

/**
 * Tone for a session of `seconds` age.
 *
 * `fresh`   — opened today. Ordinary.
 * `watch`   — open for more than a day. Normal for someone who never closes
 *             their laptop, but worth being able to see.
 * `stale`   — open for more than a week. This is the case the screen was built
 *             for; it is called out, not merely listed.
 */
export function sessionTone(seconds: number): SessionTone {
  if (seconds >= STALE_AFTER_SECONDS) return "stale";
  if (seconds >= WATCH_AFTER_SECONDS) return "watch";
  return "fresh";
}

/**
 * A short, human duration: "5 weeks", "3 days", "2 hours", "17 minutes".
 *
 * Deliberately coarse — one unit, no "5 weeks, 2 days". The question this
 * column answers is "is this old?", not "exactly how old?", and the exact
 * timestamps are in the neighbouring columns for anyone who needs them.
 * Negative or sub-minute values read as "just now" rather than "0 minutes",
 * which would look like a bug.
 */
export function formatAge(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < MINUTE) return "just now";
  const [value, unit] =
    seconds >= WEEK
      ? [Math.floor(seconds / WEEK), "week"]
      : seconds >= DAY
        ? [Math.floor(seconds / DAY), "day"]
        : seconds >= HOUR
          ? [Math.floor(seconds / HOUR), "hour"]
          : [Math.floor(seconds / MINUTE), "minute"];
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

/**
 * One sentence for the confirm dialog, so the person clicking "Revoke" sees
 * what they are ending rather than just a session id.
 */
export function describeSession(email: string | null, seconds: number): string {
  return `${email ?? "an unrecognised account"} — open for ${formatAge(seconds)}`;
}
