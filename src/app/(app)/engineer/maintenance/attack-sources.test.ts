import { describe, expect, it } from "vitest";
import {
  ATTACK_PANEL_DESCRIPTION,
  ATTACK_PANEL_HIDE_LABEL,
  ATTACK_PANEL_SHOW_LABEL,
  attackPanelHref,
  attackPanelLabel,
  attackTypeLabel,
  emptyStateText,
  formatClock,
  formatDuration,
  formatLocation,
  isAttackPanelOpen,
  splitAttackType,
  type LoginAttackSource,
} from "./attack-sources";

/**
 * The numbers in these tests are the real 2026-08-19 production campaigns:
 *
 *   66.234.153.26  (Romania)     190 attempts   68 addresses   08:47:12–08:57:23
 *   159.26.103.94  (Seattle WA)  338 attempts   78 addresses   08:58:55–09:05:12
 *   134.82.68.139  (Miami FL)    222 attempts  202 addresses   09:25:36–09:25:52
 *
 * They are used rather than round numbers because the thing this table has to
 * get right is telling the third one apart from the first two at a glance, and
 * that only shows up on the actual clocks.
 */

function source(over: Partial<LoginAttackSource> = {}): LoginAttackSource {
  return {
    ip_address: "159.26.103.94",
    city: "Seattle",
    region: "Washington",
    country: "US",
    first_seen: "2026-08-19T14:58:55Z",
    last_seen: "2026-08-19T15:05:12Z",
    attempts: 338,
    distinct_emails: 78,
    attack_type: "spraying: many addresses, a few passwords each",
    is_attack: true,
    ...over,
  };
}

describe("duration", () => {
  it("shows a 16-second burst in seconds", () => {
    // 134.82.68.139: 222 attempts inside a quarter of a minute. If this rounded
    // to "0 min" the most aggressive row in the table would read as the mildest.
    expect(formatDuration("2026-08-19T15:25:36Z", "2026-08-19T15:25:52Z")).toBe(
      "16 sec",
    );
  });

  it("shows a ten-minute grind in minutes, so the two never look alike", () => {
    const burst = formatDuration(
      "2026-08-19T15:25:36Z",
      "2026-08-19T15:25:52Z",
    );
    const grind = formatDuration(
      "2026-08-19T14:47:12Z",
      "2026-08-19T14:57:23Z",
    );
    expect(grind).toBe("10 min");
    expect(grind).not.toBe(burst);
  });

  it("keeps hours and minutes together for a slow campaign", () => {
    expect(formatDuration("2026-08-19T00:00:00Z", "2026-08-19T03:12:00Z")).toBe(
      "3 hr 12 min",
    );
    expect(formatDuration("2026-08-19T00:00:00Z", "2026-08-19T02:00:00Z")).toBe(
      "2 hr",
    );
  });

  it("says 'under a second' rather than '0 sec' for a single attempt", () => {
    // One failure means first_seen === last_seen. "0 sec" reads as missing data.
    expect(formatDuration("2026-08-19T15:25:36Z", "2026-08-19T15:25:36Z")).toBe(
      "under a second",
    );
  });

  it("does not produce a negative span if the clocks disagree", () => {
    expect(formatDuration("2026-08-19T15:25:52Z", "2026-08-19T15:25:36Z")).toBe(
      "under a second",
    );
  });

  it("degrades to a dash on an unparseable timestamp", () => {
    expect(formatDuration("not-a-date", "2026-08-19T15:25:36Z")).toBe("—");
  });
});

describe("clock", () => {
  it("renders Mountain time with seconds", () => {
    // 14:58:55Z is 08:58:55 MDT. Seconds are the point: to the minute, the
    // Miami burst's start and end are the same string.
    const shown = formatClock("2026-08-19T14:58:55Z");
    expect(shown).toContain("08:58:55");
    expect(shown).toContain("Aug 19");
  });

  it("is Mountain regardless of where the server runs", () => {
    // 03:30Z is still Aug 18 in Utah. A server rendering in UTC must not push
    // an overnight attack onto the wrong day.
    expect(formatClock("2026-08-19T03:30:00Z")).toContain("Aug 18");
  });

  it("degrades to a dash rather than 'Invalid Date'", () => {
    expect(formatClock("nonsense")).toBe("—");
  });
});

describe("location", () => {
  it("joins whatever the edge captured", () => {
    expect(formatLocation(source())).toBe("Seattle, Washington, US");
  });

  it("drops the missing parts instead of leaving gaps", () => {
    expect(
      formatLocation(
        source({ city: "Bucharest", region: null, country: "RO" }),
      ),
    ).toBe("Bucharest, RO");
  });

  it("invents nothing when there is no geo at all", () => {
    expect(
      formatLocation(source({ city: null, region: null, country: null })),
    ).toBe("—");
  });
});

describe("attack type", () => {
  it("splits the backend's one string into a cell label and its explanation", () => {
    const { label, detail } = splitAttackType(
      "spraying: many addresses, a few passwords each",
    );
    expect(label).toBe("spraying");
    expect(detail).toBe("many addresses, a few passwords each");
  });

  it("capitalises the label for the column", () => {
    expect(attackTypeLabel("enumeration: many addresses, about one each")).toBe(
      "Enumeration",
    );
    expect(
      attackTypeLabel("guessing: repeated attempts against few addresses"),
    ).toBe("Guessing");
  });

  it("renders a below-threshold source as what it is, not as an attack", () => {
    // A staff member mistyping their password. The row is still shown — seeing
    // it is the reassurance — but it must not read as a campaign.
    const label = attackTypeLabel(
      "no attack pattern: isolated failed sign-ins",
    );
    expect(label).toBe("No attack pattern");
    expect(label.toLowerCase()).not.toContain("spraying");
  });

  it("passes an unexpected shape through whole instead of blanking the cell", () => {
    // The classifier's vocabulary lives in the backend; if it ever returns a
    // pattern with no colon, the cell must still say something.
    expect(splitAttackType("something new")).toEqual({
      label: "something new",
      detail: "",
    });
    expect(attackTypeLabel("something new")).toBe("Something new");
  });

  it("never renders an empty cell", () => {
    expect(attackTypeLabel("")).toBe("—");
  });
});

describe("empty state", () => {
  it("names NO window when it is showing all of history", () => {
    // The console's default. Saying "in the last 24 hours" while the table is
    // actually showing everything is the confusion this whole change exists to
    // fix: the morning after the first real campaigns, a 24-hour window emptied
    // the table overnight and it read as the rows having been deleted.
    expect(emptyStateText(null)).toBe("No failed sign-in attempts recorded.");
    expect(emptyStateText(null)).not.toMatch(/hour|day|last/i);
  });

  it("reads as reassurance and names the window", () => {
    // What the page shows on almost every day it is opened.
    expect(emptyStateText(24)).toBe(
      "No failed sign-in attempts in the last 24 hours.",
    );
  });

  it("does not say '1 hours'", () => {
    expect(emptyStateText(1)).toBe(
      "No failed sign-in attempts in the last hour.",
    );
  });

  it("follows a retuned window", () => {
    expect(emptyStateText(6)).toBe(
      "No failed sign-in attempts in the last 6 hours.",
    );
  });
});

describe("the shape the console is handed", () => {
  it("carries a count of attempted addresses and never the addresses", () => {
    // The guarantee the backend makes, restated where the UI would break it:
    // adding an address field here is the thing this test exists to stop.
    const keys = Object.keys(source());
    expect(keys).toContain("distinct_emails");
    expect(keys.filter((k) => k.includes("email"))).toEqual([
      "distinct_emails",
    ]);
    expect(JSON.stringify(source())).not.toContain("@");
  });
});

describe("the collapsed panel on the login-failures page", () => {
  it("is CLOSED when the parameter is absent", () => {
    // The requirement, stated as the first assertion in the file that matters:
    // a reader arriving at /engineer/login-failures gets the attempt list, and
    // the summary only when they ask for it.
    expect(isAttackPanelOpen(undefined)).toBe(false);
  });

  it("stays closed for anything that is not the exact opt-in value", () => {
    // Strict on purpose. Everything here is a value a stray link, a copied URL
    // or a well-meaning refactor could produce, and every one of them must
    // still mean collapsed — the panel can only be opened deliberately.
    for (const value of [
      "",
      "0",
      "false",
      "true",
      "yes",
      "on",
      "01",
      " 1",
      null,
    ])
      expect(isAttackPanelOpen(value)).toBe(false);
  });

  it("opens only on the opt-in value", () => {
    expect(isAttackPanelOpen("1")).toBe(true);
  });

  it("round-trips through the href it generates", () => {
    // The toggle must actually reach the open state it advertises: whatever
    // `attackPanelHref` writes has to be read back as open by the page.
    const href = attackPanelHref("/engineer/login-failures", {
      open: true,
      offset: 0,
    });
    const value = new URL(href, "https://x").searchParams.get("attacks");
    expect(isAttackPanelOpen(value)).toBe(true);
  });

  it("leaves the parameter off entirely when closed, rather than writing a falsy one", () => {
    // Closed is the ABSENCE of the parameter, not `attacks=0`. Keeping it that
    // way means the default can never be flipped by changing how a value is
    // parsed — there is no value.
    expect(
      attackPanelHref("/engineer/login-failures", { open: false, offset: 0 }),
    ).toBe("/engineer/login-failures");
  });

  it("keeps the reader's place in the attempt list when toggling", () => {
    // They were on offset 150 for a reason; expanding a panel must not throw
    // them back to page one.
    expect(
      attackPanelHref("/engineer/login-failures", { open: true, offset: 150 }),
    ).toBe("/engineer/login-failures?offset=150&attacks=1");
    expect(
      attackPanelHref("/engineer/login-failures", { open: false, offset: 150 }),
    ).toBe("/engineer/login-failures?offset=150");
  });

  it("labels the button for the state it will move to", () => {
    expect(attackPanelLabel(false)).toBe(ATTACK_PANEL_SHOW_LABEL);
    expect(attackPanelLabel(true)).toBe(ATTACK_PANEL_HIDE_LABEL);
  });

  it("says what it does, whatever the joke is", () => {
    // The copy is meant to be swapped, so this does not pin the words — it pins
    // the PROPERTY that made them acceptable: a tired reader at 9pm can tell
    // what the button opens without pressing it. The subtitle carries the plain
    // meaning and stays joke-free.
    expect(ATTACK_PANEL_DESCRIPTION).toMatch(/failed sign-ins/i);
    expect(ATTACK_PANEL_DESCRIPTION).toMatch(/source ip/i);
    // And the hide label must read as the way back out.
    expect(ATTACK_PANEL_HIDE_LABEL).toMatch(/^hide/i);
  });
});
