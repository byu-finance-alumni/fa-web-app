/**
 * "Which follow-up email goes out next, and when?" (#562)
 *
 * The console showed what had ALREADY gone out per stage and nothing about what
 * comes next, so "which email was Wednesday's?" had no answer on screen. The
 * backend now works it out from the same rule the cron sends by — the lowest
 * stage anyone is still owed, dated from the campaign's own `start_date` — and
 * this turns it into the one line the schedule card shows.
 *
 * Nothing is derived here. In particular the date is NOT "today + 7": a resumed
 * campaign's `start_date` moves, and an unfinished earlier stage is sent before
 * a later one, so only the backend's answer is right. When it says there is no
 * next send (paused, cancelled, completed, or every stage delivered) the card
 * shows nothing at all — claiming a send that will not happen is worse.
 */

/** Stage names, matching the card's per-stage counts. */
const STAGE_LABELS: Record<number, string> = {
  0: "Initial email",
  1: "1-week reminder",
  2: "2-week reminder",
};

export type NextSendFields = {
  next_stage: number | null;
  next_send_date: string | null;
  next_send_count: number | null;
};

/** ISO `YYYY-MM-DD` as e.g. "Wed, Oct 14" — local midnight, so no tz drift. */
function formatSendDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * e.g. "Next: 1-week reminder · Wed, Oct 14 · ~37 people", or `null` when the
 * campaign has no next send. The count is approximate on purpose: replies before
 * that day shrink it, and the daily cap can spread it over several days.
 */
export function nextSendLine(item: NextSendFields | null): string | null {
  if (!item || item.next_stage === null || !item.next_send_date) return null;
  const stage = STAGE_LABELS[item.next_stage];
  if (!stage) return null;
  const parts = [`Next: ${stage}`, formatSendDay(item.next_send_date)];
  const n = item.next_send_count;
  if (n !== null && n > 0) {
    parts.push(`~${n.toLocaleString()} ${n === 1 ? "person" : "people"}`);
  }
  return parts.join(" · ");
}
