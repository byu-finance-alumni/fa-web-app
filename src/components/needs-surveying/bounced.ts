/**
 * The "Bounced" list on the campaign console (#858).
 *
 * `GET /survey/campaigns/{year}/bounced` names the alumni whose survey email for
 * that year was PERMANENTLY refused by the receiving server (a hard bounce, from
 * Resend's webhook). Temporary bounces are never listed. The list changes nothing
 * about anyone — staff open the profile and fix the address by hand.
 *
 * The pure parts live here so they can be pinned by a test without a DOM, like
 * `held-out.ts` next door.
 */
import type { components } from "@/types/api.gen";

import {
  formatConsoleDate,
  heldOutTruncatedNote,
} from "@/components/needs-surveying/held-out";

export type SurveyBouncedAlum = components["schemas"]["SurveyBouncedAlum"];
export type SurveyBouncedPage = components["schemas"]["SurveyBouncedPage"];

/**
 * How many names to pull. The endpoint defaults to 200 and caps at 1000; one
 * graduation year's hard bounces fit comfortably, and if a year ever exceeds
 * this the list says so — see `bouncedTruncatedNote`.
 */
export const BOUNCED_PAGE_SIZE = 500;

/** The request for one year's hard bounces. */
export function bouncedRequestPath(graduationYear: number): string {
  return `/survey/campaigns/${graduationYear}/bounced?limit=${BOUNCED_PAGE_SIZE}`;
}

/**
 * Said only when the page does not cover everyone, so a partial list is never
 * read as the whole one. Same wording as the already-replied list.
 */
export function bouncedTruncatedNote(page: SurveyBouncedPage): string {
  return heldOutTruncatedNote(page.items.length, page.total);
}

/** The headline beside the count — "1 alumnus" / "3 alumni". */
export function bouncedHeadline(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "alumnus" : "alumni"} whose email bounced`;
}

/**
 * The detail beside a name: the address that bounced, Resend's reason, the date.
 *
 * The address is the point — it is what staff came to fix — so it leads. When
 * the bounce could only be matched by its tag (no message id was recorded) the
 * address is unknown, and that is said rather than left blank.
 */
export function bouncedDetail(a: SurveyBouncedAlum): string {
  const parts: string[] = [a.bounced_address || "Address not recorded"];
  if (a.bounce_subtype) parts.push(a.bounce_subtype);
  const when = formatConsoleDate(a.bounced_at, "");
  if (when) parts.push(`Bounced ${when}`);
  return parts.join(" · ");
}

/**
 * Said only when the address that bounced is no longer on the profile, so staff
 * can skip people someone has already fixed. Empty when it is still on file, or
 * when that cannot be known.
 */
export function bouncedFixedNote(a: SurveyBouncedAlum): string {
  return a.address_still_on_file === false ? "Address since changed" : "";
}
