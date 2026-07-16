import { describe, it, expect } from "vitest";
import { suggestFromList } from "./combobox-suggest";
import { SECONDARY_INDUSTRY_OPTIONS } from "../../constants/dropdowns";

describe("suggestFromList", () => {
  it("offers the whole list for an empty query", () => {
    const options = ["Alpha", "Beta"];
    expect(suggestFromList(options, "")).toBe(options);
    expect(suggestFromList(options, "   ")).toBe(options);
  });

  it("matches case-insensitively", () => {
    expect(suggestFromList(["Consulting"], "CONSUL")).toEqual(["Consulting"]);
    expect(suggestFromList(["Consulting"], "consul")).toEqual(["Consulting"]);
  });

  it("puts prefix matches ahead of substring matches", () => {
    // "Sales" and "Sales and Trading" both start with it; "Equity Research
    // Sales" only contains it.
    const options = ["Equity Research Sales", "Sales", "Sales and Trading"];
    expect(suggestFromList(options, "sales")).toEqual([
      "Sales",
      "Sales and Trading",
      "Equity Research Sales",
    ]);
  });

  it("preserves the list's own order within each match tier", () => {
    // The vocabulary's curated order (sort_order, Other pinned last) must not
    // be re-sorted by filtering.
    const options = ["Private Banking", "Private Credit", "Private Equity"];
    expect(suggestFromList(options, "private")).toEqual(options);
  });

  it("returns [] when nothing matches — not an error", () => {
    // The combobox shows no menu and keeps the typed text; free text is valid.
    expect(suggestFromList(["Consulting"], "Insurance")).toEqual([]);
  });

  it("trims the query", () => {
    expect(suggestFromList(["Consulting"], "  consul  ")).toEqual([
      "Consulting",
    ]);
  });

  it("never invents an option the caller didn't pass", () => {
    const hits = suggestFromList(SECONDARY_INDUSTRY_OPTIONS, "an");
    for (const h of hits) expect(SECONDARY_INDUSTRY_OPTIONS).toContain(h);
  });

  it("surfaces the secondary-only industries, which primary hides", () => {
    // The whole point of #452: these are typeable/pickable HERE.
    expect(suggestFromList(SECONDARY_INDUSTRY_OPTIONS, "law")).toEqual(["Law"]);
    expect(suggestFromList(SECONDARY_INDUSTRY_OPTIONS, "credit risk")).toEqual([
      "Credit Risk",
    ]);
    expect(
      suggestFromList(SECONDARY_INDUSTRY_OPTIONS, "sales and trading"),
    ).toEqual(["Sales and Trading"]);
  });
});
