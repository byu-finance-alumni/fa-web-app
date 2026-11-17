import { describe, expect, it } from "vitest";
import {
  pathWithSearch,
  profileBack,
  returnLabel,
  returnToFor,
  safeReturnPath,
  withReturnTo,
} from "@/lib/returnTo";

/**
 * The profile's Back button (#937). `from` is user input that becomes the href
 * of a button on our page, so most of this file is the open-redirect cases.
 */
describe("safeReturnPath", () => {
  it("keeps an internal list URL, filters and all", () => {
    expect(safeReturnPath("/alumni?q=smith&industry=Banking&sort=name&offset=50")).toBe(
      "/alumni?q=smith&industry=Banking&sort=name&offset=50",
    );
    expect(safeReturnPath("/nettreks/dallas/hosts?sort=-company&offset=50")).toBe(
      "/nettreks/dallas/hosts?sort=-company&offset=50",
    );
    expect(safeReturnPath("/outreach/mentors/industry?industry=Real+Estate")).toBe(
      "/outreach/mentors/industry?industry=Real+Estate",
    );
    expect(safeReturnPath("/dashboard")).toBe("/dashboard");
  });

  it("takes the first of a repeated param and drops a hash", () => {
    expect(safeReturnPath(["/tasks?status=open", "/activity"])).toBe("/tasks?status=open");
    expect(safeReturnPath("/alumni?q=a#top")).toBe("/alumni?q=a");
  });

  it.each([
    ["absolute URL", "https://evil.example/alumni"],
    ["scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,hi"],
    ["protocol-relative", "//evil.example/alumni"],
    ["backslash host", "/\\evil.example"],
    ["backslash anywhere", "/alumni\\..\\x"],
    ["tab smuggled host", "/\t/evil.example"],
    ["newline smuggled host", "/\n/evil.example"],
    ["encoded slashes are just a path", "/%2F%2Fevil.example"],
    ["no leading slash", "alumni"],
    ["empty", ""],
    ["space", "/alumni?q=a b"],
    ["too long", `/alumni?q=${"a".repeat(2100)}`],
  ])("refuses %s", (_name, raw) => {
    expect(safeReturnPath(raw)).toBeNull();
  });

  it("refuses same-site paths that are not lists", () => {
    // Not a screen in the nav: API-ish, auth, the root.
    expect(safeReturnPath("/auth/signout")).toBeNull();
    expect(safeReturnPath("/api/anything")).toBeNull();
    expect(safeReturnPath("/")).toBeNull();
    expect(safeReturnPath("/login")).toBeNull();
    // A profile, its edit screens, and forms.
    expect(safeReturnPath("/alumni/42")).toBeNull();
    expect(safeReturnPath("/friends/9?from=/alumni")).toBeNull();
    expect(safeReturnPath("/alumni/42/edit/personal")).toBeNull();
    expect(safeReturnPath("/alumni/new")).toBeNull();
    expect(safeReturnPath("/admin/import/update")).toBeNull();
    // A dot-segment that climbs out of a list resolves to where it really goes.
    expect(safeReturnPath("/alumni/../auth/signout")).toBeNull();
  });

  it("refuses non-strings", () => {
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath([])).toBeNull();
  });
});

describe("returnLabel", () => {
  it.each([
    ["/alumni?q=smith", "Alumni"],
    ["/friends", "Friends"],
    ["/dashboard", "Dashboard"],
    ["/nettreks/dallas/hosts?offset=50", "NetTrek Hosts"],
    ["/nettreks/dallas/area_alumni", "Area Alumni"],
    ["/nettreks", "NetTreks"],
    ["/outreach/speakers/utah", "Event Speakers"],
    ["/outreach/mentors/industry?industry=Banking", "Alumni Mentors"],
    ["/outreach/conference", "Conference Interest"],
    ["/outreach/case_competition/industry?industry=Real+Estate", "Case Competition Hosts"],
    ["/outreach/event_help/all", "Event Help"],
    ["/tasks?status=open", "Tasks"],
    ["/activity", "Activity"],
    ["/needs-surveying", "Needs Surveying"],
    ["/pay-it-forward", "Pay It Forward"],
    ["/map/state/UT", "Map"],
    ["/events", "Events"],
    ["/events/12", "Event"],
  ])("%s → Back to %s", (path, label) => {
    expect(returnLabel(path)).toBe(label);
  });
});

describe("profileBack", () => {
  it("goes where the profile was opened from", () => {
    expect(profileBack("/nettreks/dallas/hosts?sort=company")).toEqual({
      href: "/nettreks/dallas/hosts?sort=company",
      label: "NetTrek Hosts",
      from: "/nettreks/dallas/hosts?sort=company",
    });
  });

  it("falls back to the plain Alumni list on a direct visit or a bad from", () => {
    const plain = { href: "/alumni", label: "Alumni", from: null };
    expect(profileBack(undefined)).toEqual(plain);
    expect(profileBack("https://evil.example")).toEqual(plain);
    expect(profileBack("//evil.example")).toEqual(plain);
  });

  it("falls back to Friends on a friend's profile", () => {
    expect(profileBack(undefined, { href: "/friends", label: "Friends" })).toEqual({
      href: "/friends",
      label: "Friends",
      from: null,
    });
  });
});

describe("withReturnTo", () => {
  it("adds from, encoded, beside an existing query and before a hash", () => {
    expect(withReturnTo("/alumni/42", "/alumni?q=a&sort=name")).toBe(
      "/alumni/42?from=%2Falumni%3Fq%3Da%26sort%3Dname",
    );
    expect(withReturnTo("/alumni/42?log=call", "/dashboard")).toBe(
      "/alumni/42?log=call&from=%2Fdashboard",
    );
    expect(withReturnTo("/alumni/42#notes", "/tasks")).toBe("/alumni/42?from=%2Ftasks#notes");
  });

  it("replaces an existing from rather than stacking a second", () => {
    expect(withReturnTo("/alumni/42?from=%2Ftasks", "/activity")).toBe(
      "/alumni/42?from=%2Factivity",
    );
  });

  it("leaves the href alone for a missing or unsafe from", () => {
    expect(withReturnTo("/alumni/42", null)).toBe("/alumni/42");
    expect(withReturnTo("/alumni/42", "//evil.example")).toBe("/alumni/42");
    expect(withReturnTo("/alumni/42?log=call", "https://evil.example")).toBe(
      "/alumni/42?log=call",
    );
  });

  it("round-trips: the profile reads back exactly the list URL", () => {
    const list = "/alumni?q=o%27brien&industry=Real+Estate&offset=100";
    const href = withReturnTo("/alumni/42", list);
    const from = new URL(href, "http://x").searchParams.get("from");
    expect(safeReturnPath(from)).toBe(list);
  });
});

describe("pathWithSearch / returnToFor", () => {
  it("rebuilds a page URL from route searchParams, repeated keys kept", () => {
    expect(
      pathWithSearch("/alumni", { q: "smith", tag: ["a", "b"], empty: undefined }),
    ).toBe("/alumni?q=smith&tag=a&tag=b");
    expect(pathWithSearch("/tasks", {})).toBe("/tasks");
  });

  it("carries the list itself from a list page", () => {
    expect(returnToFor("/alumni", new URLSearchParams("q=smith"))).toBe("/alumni?q=smith");
  });

  it("forwards a profile's own from, so profile → profile still returns to the list", () => {
    expect(
      returnToFor("/alumni/42", new URLSearchParams("from=%2Ftasks%3Fstatus%3Dopen&tab=notes")),
    ).toBe("/tasks?status=open");
    expect(returnToFor("/alumni/42", new URLSearchParams())).toBeNull();
  });

  it("carries nothing from a form or an unknown screen", () => {
    expect(returnToFor("/admin/import/update", new URLSearchParams())).toBeNull();
    expect(returnToFor("/alumni/new", new URLSearchParams())).toBeNull();
  });
});

/**
 * fa-web-app#944: every page that opens a profile, as the URL its profile links
 * carry in `from`. Each must survive `safeReturnPath` UNCHANGED — a refusal is
 * the silent fallback to the plain Alumni list the bug report described — and
 * the Back button must name the place.
 */
describe("#944 every profile source is a valid return target", () => {
  it.each([
    // [page URL a profile link was clicked on, Back label]
    ["/alumni?q=smith&industry=Banking&sort=grad_desc&offset=50", "Alumni"],
    ["/alumni?industry_group=other&secondary_industry_group=Healthcare", "Alumni"],
    ["/alumni?industry_group=other&no_secondary_industry=1", "Alumni"],
    ["/friends?q=jones", "Friends"],
    ["/dashboard", "Dashboard"],
    ["/dashboard?drawer=contacted", "Dashboard"],
    ["/dashboard?drawer=followups", "Dashboard"],
    ["/dashboard/other-industries", "Other industries"],
    ["/outreach/speakers/utah?sort=-company&offset=50", "Event Speakers"],
    ["/outreach/sponsors/out_of_state", "Event Sponsors"],
    ["/outreach/conference/real_estate", "Conference Interest"],
    ["/outreach/mentors/industry?industry=Real+Estate", "Alumni Mentors"],
    ["/outreach/mentors/women", "Alumni Mentors"],
    ["/nettreks/dallas/hosts?sort=company", "NetTrek Hosts"],
    ["/nettreks/dallas/area_alumni?offset=50", "Area Alumni"],
    ["/tasks?status=open&assignee=me", "Tasks"],
    ["/activity?from=2026-01-01&to=2026-02-01&type=call", "Activity"],
    ["/needs-surveying?year=2020&unreachable=1", "Needs Surveying"],
    ["/needs-surveying?year=2020&tab=submissions&replied=1", "Needs Surveying"],
    ["/pay-it-forward", "Pay It Forward"],
    ["/events?event=12&event_tab=attendees", "Events"],
    ["/events?from=2025-01-01&q=gala", "Events"],
    ["/events/12", "Event"],
    ["/map?view=world&country=united+kingdom", "Map"],
    ["/map/state/UT", "Map"],
    ["/audit?entity_type=alumni&offset=50", "Audit"],
    ["/reports", "Reports"],
    ["/data-quality", "Data quality"],
  ])("%s → Back to %s", (path, label) => {
    expect(safeReturnPath(path)).toBe(path);
    expect(profileBack(path)).toEqual({ href: path, label, from: path });
  });

  it("accepts an Outreach list that is not in the menu yet (new lists inherit Back)", () => {
    const path = "/outreach/case_competition/hosts?sort=company";
    expect(safeReturnPath(path)).toBe(path);
    expect(returnLabel(path)).toBe("Outreach");
  });

  it("still refuses everything outside the app's own lists", () => {
    for (const raw of [
      "/outreach",
      "/outreachx/evil",
      "//outreach/x",
      "/outreach/\\evil.example",
      "/outreach/x/../../auth/signout",
      "https://evil.example/outreach/x",
      "/api/outreach/x",
    ]) {
      expect(safeReturnPath(raw)).toBeNull();
    }
  });
});

describe("#944 link builder: the page's own URL is what Back returns to", () => {
  it("keeps a page's own date `from` (Activity, Events) instead of dropping it", () => {
    const sp = new URLSearchParams("from=2026-01-01&to=2026-02-01&type=call");
    expect(returnToFor("/activity", sp)).toBe(
      "/activity?to=2026-02-01&type=call&from=2026-01-01",
    );
    const href = withReturnTo("/alumni/42", returnToFor("/activity", sp));
    const from = new URL(href, "http://x").searchParams.get("from");
    expect(new URLSearchParams(from!.split("?")[1]).get("from")).toBe("2026-01-01");
    expect(
      pathWithSearch("/events", { from: "2025-01-01", q: "gala" }),
    ).toBe("/events?q=gala&from=2025-01-01");
  });

  it("still drops a nested return path", () => {
    expect(pathWithSearch("/alumni", { q: "a", from: "/tasks" })).toBe("/alumni?q=a");
  });

  it("carries drawer / year / country state written into the URL", () => {
    expect(returnToFor("/dashboard", new URLSearchParams("drawer=contacted"))).toBe(
      "/dashboard?drawer=contacted",
    );
    expect(
      returnToFor("/needs-surveying", new URLSearchParams("year=2019&unreachable=1")),
    ).toBe("/needs-surveying?year=2019&unreachable=1");
    expect(returnToFor("/map", new URLSearchParams("view=world&country=japan"))).toBe(
      "/map?view=world&country=japan",
    );
  });

  it("profile → Edit → Save keeps the original list", () => {
    const list = "/outreach/mentors/industry?industry=Real+Estate&offset=50";
    // Profile's Edit button, then the section link, then the save redirect.
    const edit = withReturnTo("/alumni/42/edit", list);
    const fromOnEdit = new URL(edit, "http://x").searchParams.get("from");
    const saved = withReturnTo("/alumni/42?duplicate_of=7", safeReturnPath(fromOnEdit));
    expect(profileBack(new URL(saved, "http://x").searchParams.get("from"))).toEqual({
      href: list,
      label: "Alumni Mentors",
      from: list,
    });
  });

  it("the profile's in-page employment link keeps from", () => {
    // The bare "?tab=employment" href dropped it (#944).
    expect(withReturnTo("/alumni/42?tab=employment", "/tasks?status=open")).toBe(
      "/alumni/42?tab=employment&from=%2Ftasks%3Fstatus%3Dopen",
    );
  });
});
