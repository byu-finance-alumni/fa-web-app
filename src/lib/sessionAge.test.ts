import { describe, expect, it } from "vitest";

import {
  describeSession,
  formatAge,
  sessionTone,
  STALE_AFTER_SECONDS,
  WATCH_AFTER_SECONDS,
} from "@/lib/sessionAge";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

describe("formatAge", () => {
  it("reads as 'just now' below a minute, never '0 minutes'", () => {
    expect(formatAge(0)).toBe("just now");
    expect(formatAge(59)).toBe("just now");
    // Clock skew between server and browser must not print "-1 minutes".
    expect(formatAge(-30)).toBe("just now");
  });

  it("uses a single coarse unit and pluralises it", () => {
    expect(formatAge(MINUTE)).toBe("1 minute");
    expect(formatAge(17 * MINUTE)).toBe("17 minutes");
    expect(formatAge(HOUR)).toBe("1 hour");
    expect(formatAge(5 * HOUR)).toBe("5 hours");
    expect(formatAge(DAY)).toBe("1 day");
    expect(formatAge(3 * DAY)).toBe("3 days");
    expect(formatAge(WEEK)).toBe("1 week");
  });

  it("describes the real finding — a five-week-old session — as weeks", () => {
    expect(formatAge(35 * DAY)).toBe("5 weeks");
  });
});

describe("sessionTone", () => {
  it("treats a session opened today as ordinary", () => {
    expect(sessionTone(0)).toBe("fresh");
    expect(sessionTone(23 * HOUR)).toBe("fresh");
  });

  it("flags anything older than a day for a look", () => {
    expect(sessionTone(WATCH_AFTER_SECONDS)).toBe("watch");
    expect(sessionTone(3 * DAY)).toBe("watch");
  });

  it("calls out anything older than a week", () => {
    expect(sessionTone(STALE_AFTER_SECONDS)).toBe("stale");
    expect(sessionTone(35 * DAY)).toBe("stale");
  });

  it("keeps the thresholds ordered so a tone can never be skipped", () => {
    expect(WATCH_AFTER_SECONDS).toBeLessThan(STALE_AFTER_SECONDS);
  });
});

describe("describeSession", () => {
  it("names the account and how long it has been open", () => {
    expect(describeSession("colleague@byu.edu", 35 * DAY)).toBe(
      "colleague@byu.edu, open for 5 weeks",
    );
  });

  it("still reads sensibly for a session with no matching app user", () => {
    expect(describeSession(null, HOUR)).toBe(
      "an unrecognised account, open for 1 hour",
    );
  });
});
