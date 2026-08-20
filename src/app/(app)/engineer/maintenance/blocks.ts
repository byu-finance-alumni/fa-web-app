/**
 * Presentation logic for the automatic-block table.
 *
 * The table itself renders on /engineer/login-failures, next to the attempts
 * that produced the blocks; these helpers stay here beside ./attack-sources,
 * which they are the other half of — one describes who is hitting the login,
 * the other what was done about them, and splitting the pair across two route
 * folders would buy nothing.
 *
 * Same split as ./attack-sources: everything here is pure and takes plain data,
 * so the assertions that matter — a block that has 40 seconds left does not read
 * as "an hour", a lifted block never reads as active — are cheap to write here
 * and impossible to write against a rendered server component in this suite.
 */

import type { components } from "@/types/api.gen";

/**
 * Types for GET /admin/login-ip-blocks, taken from the generated schema so the
 * CI drift guard covers this contract.
 *
 * NOTE WHAT IS DELIBERATELY ABSENT, exactly as on the attack table: the
 * attempted email addresses. The endpoint returns `distinct_email_count`, the
 * COUNT, and never the addresses themselves.
 */
export type LoginIpBlockPage = components["schemas"]["LoginIpBlockPage"];
export type LoginIpBlock = LoginIpBlockPage["items"][number];

/**
 * How many blocks to ask for. Blocks are rare by construction — a source has to
 * cross the abuse threshold to get one — so this is a ceiling nothing is
 * expected to reach, not a page size. The backend caps the parameter at 200.
 */
export const BLOCK_LIST_LIMIT = 50;

/**
 * Utah time, to the minute.
 *
 * Deliberately NOT the seconds-precision clock the attack table uses. There the
 * seconds carry the information (222 attempts inside sixteen seconds); here the
 * interesting quantity is how long is LEFT, which `formatRemaining` answers
 * directly, and a block's start time only needs to place it in the day.
 */
export function formatBlockTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Denver",
  });
}

/**
 * "43 minutes left" / "Expired" — how long an active block still has to run.
 *
 * Rounds UP, so a block with one second left reads as "1 minute left" rather
 * than "0 minutes left", which would look like a broken control rather than one
 * about to lapse. Anything at or below zero is over: the row's `active` flag is
 * computed by the database, but the countdown is rendered from a timestamp that
 * was true when the page was fetched, and a tab left open must not keep
 * insisting a lapsed block is still holding.
 */
export function formatRemaining(
  blockedUntil: string,
  now: Date = new Date(),
): string {
  const until = new Date(blockedUntil);
  if (Number.isNaN(until.getTime())) return "—";
  const seconds = (until.getTime() - now.getTime()) / 1000;
  if (seconds <= 0) return "Expired";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${hours} hour${hours === 1 ? "" : "s"} left`
    : `${hours}h ${rest}m left`;
}

/** What a row is doing right now, in the order the reader cares about. */
export type BlockState = "active" | "lifted" | "expired";

/**
 * Classify one row. `active` comes from the database (`lifted_at IS NULL AND
 * blocked_until > now()`), which is the authority; the clock check below only
 * demotes a row an open tab has outlived, and never promotes one.
 */
export function blockState(
  block: LoginIpBlock,
  now: Date = new Date(),
): BlockState {
  if (block.lifted_at) return "lifted";
  if (!block.active) return "expired";
  return new Date(block.blocked_until).getTime() > now.getTime()
    ? "active"
    : "expired";
}

/**
 * The human sentence for a state. "Lifted" and "Expired" are distinguished on
 * purpose: one means a person decided this was wrong, the other means the hour
 * simply ran out, and telling them apart is most of the value of keeping the
 * history at all.
 */
export function blockStateLabel(state: BlockState): string {
  return state === "active"
    ? "Blocked"
    : state === "lifted"
      ? "Lifted"
      : "Expired";
}

/**
 * Why the source was blocked, in plain words.
 *
 * The backend's `pattern` is one of a fixed set of strings ('enumeration: …',
 * 'spraying: …', 'guessing: …') and never anything derived from input, so the
 * prefix is safe to switch on. The counts are the sentence's substance, though —
 * the pattern name alone tells an engineer at 2am nothing that "78 addresses,
 * 338 attempts" does not.
 */
export function blockReason(block: LoginIpBlock): string {
  const emails = block.distinct_email_count;
  const attempts = block.attempt_count;
  const shape = (block.pattern ?? "").split(":")[0].trim().toLowerCase();
  const kind =
    shape === "enumeration"
      ? "Tried many addresses"
      : shape === "spraying"
        ? "Sprayed one password across accounts"
        : shape === "guessing"
          ? "Hammered one account"
          : "Repeated failed sign-ins";
  return `${kind} — ${attempts} attempt${
    attempts === 1 ? "" : "s"
  } across ${emails} address${emails === 1 ? "" : "es"}`;
}

/**
 * What the table says when it is empty, which is what it says on almost every
 * day it is looked at.
 *
 * The two empty states are NOT the same and must not read the same. With
 * blocking armed, "nothing is blocked" is the reassurance the page exists to
 * give. With the kill switch off it means nothing at all, and presenting an
 * empty list as if it did would be the worst thing this screen could do.
 */
export function blocksEmptyText(autoBlockEnabled: boolean): string {
  return autoBlockEnabled
    ? "No sources are blocked. Nothing has crossed the threshold recently."
    : "Automatic blocking is turned off, so nothing is being blocked. This list is not evidence that nobody is attacking the login.";
}

/** "1 hour" / "30 minutes" — how long a new block lasts, from the backend. */
export function formatBlockLength(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
