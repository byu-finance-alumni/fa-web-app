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
