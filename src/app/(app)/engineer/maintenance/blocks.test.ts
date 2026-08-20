import { describe, expect, it } from "vitest";
import {
  blockReason,
  blockState,
  blockStateLabel,
  blocksEmptyText,
  formatBlockLength,
  formatBlockTime,
  formatRemaining,
  type LoginIpBlock,
} from "./blocks";

/**
 * The block table's presentation rules.
 *
 * The assertions that matter are the ones where a wrong answer would MISLEAD an
 * engineer during an incident: a lapsed block that still reads as holding, a
 * lifted block that reads as expired, and — most of all — an empty list that
 * reads as "nobody is attacking" when blocking is switched off.
 */

function block(over: Partial<LoginIpBlock> = {}): LoginIpBlock {
  return {
    block_id: 1,
    ip_address: "134.82.68.139",
    blocked_at: "2026-08-19T15:25:00Z",
    blocked_until: "2026-08-19T16:25:00Z",
    active: true,
    attempt_count: 222,
    distinct_email_count: 202,
    pattern: "enumeration: 202 addresses",
    abuse_incident_id: 7,
    lifted_at: null,
    lifted_by_user_id: null,
    ...over,
  };
}

describe("formatRemaining", () => {
  it("rounds UP so a block about to lapse never reads as zero", () => {
    // "0 minutes left" reads as a broken control rather than one with a second
    // to run.
    const now = new Date("2026-08-19T16:24:59Z");
    expect(formatRemaining("2026-08-19T16:25:00Z", now)).toBe("1 minute left");
  });

  it("says Expired once the deadline has passed", () => {
    // A tab left open must not keep insisting a lapsed block is still holding.
    const now = new Date("2026-08-19T17:00:00Z");
    expect(formatRemaining("2026-08-19T16:25:00Z", now)).toBe("Expired");
  });

  it("reads a full hour as hours, not sixty minutes", () => {
    const now = new Date("2026-08-19T15:25:00Z");
    expect(formatRemaining("2026-08-19T16:25:00Z", now)).toBe("1 hour left");
  });

  it("keeps the minutes when there are some", () => {
    const now = new Date("2026-08-19T15:00:00Z");
    expect(formatRemaining("2026-08-19T16:25:00Z", now)).toBe("1h 25m left");
  });

  it("does not invent a countdown from a malformed timestamp", () => {
    expect(formatRemaining("not a date")).toBe("—");
  });
});

describe("blockState", () => {
  it("trusts the database's active flag", () => {
    const now = new Date("2026-08-19T15:30:00Z");
    expect(blockState(block(), now)).toBe("active");
  });

  it("demotes a row the open tab has outlived", () => {
    // `active` was true when the page was fetched; the deadline has since gone.
    const now = new Date("2026-08-19T18:00:00Z");
    expect(blockState(block(), now)).toBe("expired");
  });

  it("never promotes a row the database called inactive", () => {
    const now = new Date("2026-08-19T15:30:00Z");
    expect(blockState(block({ active: false }), now)).toBe("expired");
  });

  it("distinguishes lifted from expired", () => {
    // One means a person decided this was wrong; the other means the hour ran
    // out. Telling them apart is most of the value of keeping the history.
    const lifted = block({
      active: false,
      lifted_at: "2026-08-19T15:40:00Z",
      lifted_by_user_id: 3,
    });
    expect(blockState(lifted)).toBe("lifted");
    expect(blockStateLabel(blockState(lifted))).toBe("Lifted");
  });
});

describe("blocksEmptyText", () => {
  it("does not present an empty list as safety when blocking is off", () => {
    // The one thing this screen must never do: an empty table with the kill
    // switch off means nothing at all.
    const off = blocksEmptyText(false);
    expect(off).toContain("is off");
    expect(off).not.toBe(blocksEmptyText(true));
  });

  it("reassures when blocking is armed and nothing is blocked", () => {
    expect(blocksEmptyText(true)).toContain("No sources are blocked");
  });
});

describe("blockReason", () => {
  it("leads with the counts, whatever the pattern is called", () => {
    expect(blockReason(block())).toContain("222 attempts across 202 addresses");
  });

  it("names the shape of each known pattern", () => {
    expect(blockReason(block({ pattern: "spraying: 78 addresses" }))).toContain(
      "Sprayed",
    );
    expect(blockReason(block({ pattern: "guessing: 30 attempts" }))).toContain(
      "Hammered",
    );
  });

  it("still says something useful with no pattern at all", () => {
    // `pattern` is nullable — a block can exist with no incident row behind it.
    expect(blockReason(block({ pattern: null }))).toContain(
      "Repeated failed sign-ins",
    );
  });

  it("gets the singulars right", () => {
    const one = block({ attempt_count: 1, distinct_email_count: 1 });
    expect(blockReason(one)).toContain("1 attempt across 1 address");
  });
});

describe("formatBlockTime / formatBlockLength", () => {
  it("renders nothing for an absent timestamp", () => {
    expect(formatBlockTime(null)).toBe("—");
    expect(formatBlockTime("not a date")).toBe("—");
  });

  it("reports the backend's block length in whole hours when it is one", () => {
    expect(formatBlockLength(3600)).toBe("1 hour");
    expect(formatBlockLength(7200)).toBe("2 hours");
    expect(formatBlockLength(900)).toBe("15 minutes");
  });
});
