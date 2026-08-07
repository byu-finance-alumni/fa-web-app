/**
 * The Submissions tab's count badge (Jake, 2026-08-07).
 *
 * Three things decide whether this badge is worth having, and all three are
 * pinned here: it is SILENT when there is nothing to review, it says the right
 * number when there is, and it counts the same list the panel renders rather
 * than a request of its own — a badge that can disagree with the list under it
 * is worse than no badge.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PENDING_BADGE_MAX,
  pendingBadgeText,
  pendingReviewCount,
  submissionsTabLabel,
} from "./pending-review";

const read = (relPath: string): string =>
  readFileSync(resolve(process.cwd(), relPath), "utf8");

describe("pendingReviewCount", () => {
  it("is the length of the list the panel renders", () => {
    expect(pendingReviewCount([{}, {}, {}])).toBe(3);
    expect(pendingReviewCount([])).toBe(0);
  });

  it("keeps 'not loaded yet' distinct from 'none waiting'", () => {
    // The badge treats them differently: unknown shows nothing YET, zero shows
    // nothing EVER. Flattening them here is how a badge flashes a wrong number.
    expect(pendingReviewCount(null)).toBeNull();
    expect(pendingReviewCount(undefined)).toBeNull();
    expect(pendingReviewCount([])).not.toBeNull();
  });
});

describe("pendingBadgeText", () => {
  it("shows nothing at all when there is nothing to review", () => {
    // NOT "0". A badge that is present on every visit is a badge nobody reads,
    // which costs the one it was added for: the visit where it isn't zero.
    expect(pendingBadgeText(0)).toBe("");
  });

  it("shows nothing while the count is still unknown", () => {
    // No badge before the fetch resolves — better a beat of nothing than a
    // number that has to be taken back.
    expect(pendingBadgeText(null)).toBe("");
  });

  it("shows the number once there is work waiting", () => {
    expect(pendingBadgeText(1)).toBe("1");
    expect(pendingBadgeText(3)).toBe("3");
    expect(pendingBadgeText(PENDING_BADGE_MAX)).toBe(String(PENDING_BADGE_MAX));
  });

  it("stays a glanceable dot past the cap", () => {
    // The exact figure is still in the tab's accessible name and in the panel's
    // own "N to review" badge, so nothing is lost by not printing it here.
    expect(pendingBadgeText(PENDING_BADGE_MAX + 1)).toBe(
      `${PENDING_BADGE_MAX}+`,
    );
    expect(pendingBadgeText(4210)).toBe(`${PENDING_BADGE_MAX}+`);
  });

  it("never prints a negative", () => {
    // Only reachable from a bad count upstream, but it must not surface as a
    // circle reading "-1".
    expect(pendingBadgeText(-2)).toBe("");
  });
});

describe("submissionsTabLabel", () => {
  it("says what the number IS, not just the number", () => {
    // Read aloud, "Submissions, 3" could be a position in a list or a shortcut.
    expect(submissionsTabLabel(3)).toBe("Submissions, 3 waiting for review");
  });

  it("is just the tab name when nothing is waiting", () => {
    expect(submissionsTabLabel(0)).toBe("Submissions");
    expect(submissionsTabLabel(null)).toBe("Submissions");
  });
});

/**
 * Guards on the wiring. The functions above can be perfect and the badge still
 * be wrong, if it ends up counting a second, independent fetch.
 */
describe("the badge and the list read one source", () => {
  const hook = read("src/components/needs-surveying/use-pending-submissions.ts");
  const panel = read("src/components/needs-surveying/PendingSubmissions.tsx");
  const console_ = read(
    "src/components/needs-surveying/SurveyCampaignConsole.tsx",
  );

  it("fetches the queue in exactly one place", () => {
    // The list endpoint is requested by the hook and by nobody else. Two
    // callers is how the tab ends up badging "3" over a list of two. (The
    // panel still POSTs `/survey/responses/{id}/apply|reject` — that is the
    // write, not a second read of the queue.)
    expect(hook).toContain("campaigns/${gradYear}/responses`");
    expect(panel).not.toContain("/responses`");
    expect(console_).not.toContain("/responses`");
  });

  it("hands the panel the same queue the badge counts", () => {
    expect(console_).toContain("usePendingSubmissions(selectedYear)");
    expect(console_).toContain("pendingReviewCount(pending.items)");
    expect(console_).toContain("<PendingSubmissions queue={pending} />");
  });

  it("counts the badge off the year that is selected NOW", () => {
    // The console is a client component and the year is a dropdown. A queue
    // pinned to the first year loaded would badge the wrong class all afternoon.
    expect(hook).toContain("[gradYear, nonce]");
    // ...and the previous class's rows are cleared on the way, so the badge
    // can't show last year's figure against this year's heading.
    expect(hook).toContain("setItems(null);");
  });

  it("resolves a reviewed row out of the shared state, not by refetching", () => {
    // Apply/reject must clear the badge in the same render that drops the row —
    // "without a page reload" is the requirement, and a refetch here would also
    // race the write it just made.
    expect(panel).toContain("removeItem(id)");
    expect(panel).not.toContain("setItems(");
  });

  it("puts the badge on the tab through the shared derivation", () => {
    expect(console_).toContain("submissionsTabLabel(pendingCount)");
    expect(console_).toContain("<PendingCountBadge count={pendingCount} />");
    expect(console_).toContain("pendingBadgeText(count)");
  });

  it("reserves the badge's space so the tab strip never shifts", () => {
    // The slot is rendered at a fixed size whether or not there is a number in
    // it; only the fill appears. Otherwise "Progress" jumps sideways the moment
    // a submission lands or the last one is applied.
    expect(console_).toContain("inline-flex h-5 w-6 shrink-0");
  });
});
