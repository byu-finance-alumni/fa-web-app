/**
 * Which schedule row the Schedule tab reads (#857).
 *
 * The console needs two different answers to "what is this year's schedule?":
 *
 *   • The CONTROLS (date prefill, Schedule vs. Reschedule, Cancel) only make
 *     sense on a runnable campaign, so a cancelled/completed/paused row must
 *     read as "no schedule" there — otherwise a finished year looks live.
 *   • The RECORD (the per-stage sent boxes, "Last auto-send") must keep showing
 *     what actually went out after the campaign stops. Filtering those through
 *     the runnable-only lookup made every finished campaign read 0 / 0 / 0.
 */

type ScheduleRow = { graduation_year: number; status: string };

/** A schedule the auto-sender will still act on. */
export function isRunnableSchedule(s: ScheduleRow): boolean {
  return s.status === "scheduled" || s.status === "active";
}

/** The selected year's runnable schedule, or null — drives the controls. */
export function findRunnableSchedule<T extends ScheduleRow>(
  schedules: readonly T[] | null,
  year: number | null,
): T | null {
  return (
    schedules?.find(
      (s) => s.graduation_year === year && isRunnableSchedule(s),
    ) ?? null
  );
}

/**
 * The selected year's schedule in ANY status, or null — drives the sent counts
 * and "Last auto-send". A runnable row wins if one exists, so a live campaign
 * never shows a stale row's numbers.
 */
export function findDisplaySchedule<T extends ScheduleRow>(
  schedules: readonly T[] | null,
  year: number | null,
): T | null {
  return (
    findRunnableSchedule(schedules, year) ??
    schedules?.find((s) => s.graduation_year === year) ??
    null
  );
}
