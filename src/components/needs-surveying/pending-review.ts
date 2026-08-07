/**
 * The "something is waiting" count on the console's Submissions tab
 * (Jake, 2026-08-07).
 *
 * The review queue lives one click away, so a queue with three submissions in it
 * looks exactly like an empty one until someone thinks to go and check. The
 * badge is the only thing on this screen that says there is work without being
 * asked — which is also why it has to be silent when there ISN'T any: a circle
 * showing "0" is present on every visit, and a badge that is always there is a
 * badge nobody reads.
 *
 * The pure parts live here so a test can pin them without a DOM, like
 * `held-out.ts` and `campaign-progress.ts` next door. The COUNT itself is not
 * fetched here — it is derived from the very array the Submissions panel
 * renders (see `usePendingSubmissions`), because a badge that counts its own
 * separate request is a badge that can disagree with the list underneath it.
 */

/**
 * The largest number the circle prints. Beyond it the badge reads "99+" so the
 * shape stays a glanceable dot rather than growing into a figure. Nothing is
 * lost: the exact number is in the tab's accessible name, and the panel's own
 * "N to review" badge spells it out in full.
 *
 * One graduation year's queue realistically never gets near this.
 */
export const PENDING_BADGE_MAX = 99;

/**
 * How many submissions are waiting, from the list the panel renders.
 *
 * `null` means "not known yet" — the fetch hasn't resolved — and is deliberately
 * NOT flattened to 0 here. The two are different claims and the badge treats
 * them differently: unknown shows nothing yet, zero shows nothing ever.
 */
export function pendingReviewCount(
  items: readonly unknown[] | null | undefined,
): number | null {
  return items ? items.length : null;
}

/**
 * What the circle prints — empty string when there must be no circle at all.
 *
 * Both the loading state and a genuinely empty queue return "", so the badge
 * cannot flash a wrong number on the way in or linger at zero on the way out.
 */
export function pendingBadgeText(count: number | null): string {
  if (count === null || count <= 0) return "";
  return count > PENDING_BADGE_MAX ? `${PENDING_BADGE_MAX}+` : String(count);
}

/**
 * The tab's accessible name.
 *
 * A bare number next to a word is meaningless read aloud — "Submissions, 3"
 * could be a position in a list or a shortcut key. The count is announced as
 * what it is, and the badge itself is hidden from the accessibility tree so it
 * is never read twice. With nothing waiting the name is just the tab.
 */
export function submissionsTabLabel(count: number | null): string {
  if (count === null || count <= 0) return "Submissions";
  return `Submissions, ${count.toLocaleString()} waiting for review`;
}
