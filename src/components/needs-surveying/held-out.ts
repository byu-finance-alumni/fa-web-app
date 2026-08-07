/**
 * The "already replied" drill-down on the send breakdown (#658).
 *
 * The console reports the exclusions as bare counts. A count is not actionable:
 * Jake cancelled a campaign, went to re-send to the cohort, and was told
 * "1 already replied within the last year" — with no way to tell whether that 1
 * was the alumna he was trying to reach. He ended up searching the cohort by
 * hand in the engineer console until she turned up.
 *
 * `GET /survey/campaigns/{year}/held-out` is that same number with names on it.
 * The pure parts — which bucket to ask for, how to spell the reply date — live
 * here so they can be pinned by a test without a DOM, like `campaign-progress.ts`
 * and `campaign-remove-mode.ts` next door.
 */

/**
 * The bucket this drill-down asks for. The endpoint also serves `suppressed` and
 * `unreachable`; only this one is expanded here, because the other two are
 * already surfaced on this screen (unreachable has its own list, suppressed is a
 * decision to honour rather than something to act on).
 */
export const HELD_OUT_ALREADY_RESPONDED = "already_responded";

/**
 * How many names to pull. The endpoint's own default is 200 and its ceiling is
 * 1000; a cohort is a single graduation year, so one page is the whole bucket in
 * practice and there is no pager. If a year ever exceeds this the panel says so
 * rather than silently showing a prefix — see `heldOutTruncatedNote`.
 */
export const HELD_OUT_PAGE_SIZE = 500;

/** The request for one year's already-replied names. */
export function heldOutRequestPath(graduationYear: number): string {
  return (
    `/survey/campaigns/${graduationYear}/held-out` +
    `?reason=${HELD_OUT_ALREADY_RESPONDED}&limit=${HELD_OUT_PAGE_SIZE}`
  );
}

/**
 * Said only when the page does not cover the bucket, so nobody reads a partial
 * list as the complete one — the whole point of the panel is being able to tell
 * whether a specific person is in it. Empty string when everything is shown.
 */
export function heldOutTruncatedNote(shown: number, total: number): string {
  if (shown >= total) return "";
  return `Showing the first ${shown.toLocaleString()} of ${total.toLocaleString()}.`;
}

/**
 * A timestamp as THIS console writes dates — "Mar 3, 2026".
 *
 * Shared with the console's own `formatWhen` (which passes "Never") rather than
 * re-implemented, because a reply date rendered in a different format than the
 * "Last auto-send" stat two inches above it reads as a different kind of thing.
 * The fallback is the caller's, since "no date" means something different in
 * each spot.
 */
export function formatConsoleDate(
  iso: string | null | undefined,
  fallback: string,
): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? fallback
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

/**
 * When this alumnus replied — the point of the whole list.
 *
 * The date is what decides the question the count cannot answer: someone who
 * answered three weeks ago should be left alone, someone who answered eleven
 * months ago probably should not be. So it is rendered as a sentence beside the
 * name, not tucked into a tooltip.
 *
 * `last_reply_at` is only populated for the `already_responded` bucket, so a
 * missing date here means the backend sent a row it shouldn't have — say so
 * plainly instead of printing a dash that reads as "never replied".
 */
export function repliedLabel(lastReplyAt: string | null | undefined): string {
  const when = formatConsoleDate(lastReplyAt, "");
  return when ? `Replied ${when}` : "Reply date not recorded";
}
