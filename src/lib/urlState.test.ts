import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceUrlParams, withSearchUpdates } from "@/lib/urlState";
import { parseConsoleParams } from "@/components/needs-surveying/SurveyCampaignConsole";
import { parseDrawer } from "@/components/dashboard/KpiDrawers";
import { eventTab } from "@/components/events/EventsExplorer";

/** #944: on-screen state mirrored into the URL so a profile's Back restores it. */
describe("withSearchUpdates", () => {
  it("sets, replaces and removes keys, leaving the rest alone", () => {
    expect(withSearchUpdates("?q=a", { drawer: "contacted" })).toBe("?q=a&drawer=contacted");
    expect(withSearchUpdates("q=a&drawer=x", { drawer: "followups" })).toBe(
      "?q=a&drawer=followups",
    );
    expect(withSearchUpdates("?q=a&drawer=x", { drawer: null })).toBe("?q=a");
    expect(withSearchUpdates("?drawer=x", { drawer: "" })).toBe("");
    expect(withSearchUpdates("", {})).toBe("");
  });
});

describe("replaceUrlParams", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("replaces the current entry (no navigation) with null state", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/dashboard", search: "?q=a", hash: "" },
      history: { replaceState, state: { __NA: true } },
    });
    replaceUrlParams({ drawer: "contacted" });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/dashboard?q=a&drawer=contacted");
  });

  it("does nothing when nothing changes", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/dashboard", search: "", hash: "" },
      history: { replaceState, state: null },
    });
    replaceUrlParams({ drawer: null });
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("state readers ignore anything unrecognised", () => {
  it("dashboard drawer", () => {
    expect(parseDrawer("contacted")).toBe("contacted");
    expect(parseDrawer("followups")).toBe("followups");
    expect(parseDrawer("x")).toBeNull();
    expect(parseDrawer(null)).toBeNull();
  });

  it("event sheet tab", () => {
    expect(eventTab("attendees")).toBe("attendees");
    expect(eventTab("notes")).toBe("notes");
    expect(eventTab("evil")).toBe("overview");
    expect(eventTab(null)).toBe("overview");
  });

  it("needs-surveying console", () => {
    expect(
      parseConsoleParams(new URLSearchParams("year=2020&tab=submissions&unreachable=1&replied=1")),
    ).toEqual({ year: 2020, tab: "submissions", unreachable: true, replied: true });
    expect(parseConsoleParams(new URLSearchParams("year=20x&tab=evil&unreachable=yes"))).toEqual({
      year: null,
      tab: null,
      unreachable: false,
      replied: false,
    });
    expect(parseConsoleParams(null).year).toBeNull();
  });
});
