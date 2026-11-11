import { describe, expect, it } from "vitest";
import { parseAlumniFilters, toAlumniPopulationParams } from "@/lib/alumniFilterParams";
import { toExportFilters } from "@/lib/exportFilters";
import { otherIndustryHref } from "@/lib/otherIndustries";

const spOf = (href: string) =>
  Object.fromEntries(new URL(href, "http://x").searchParams.entries());

describe("the dashboard Other table links (#936)", () => {
  it("opens Other + the row's secondary-industry group", () => {
    const href = otherIndustryHref({
      name: "FP&A",
      group: "FP&A",
      no_secondary: false,
      count: 5,
    });
    expect(href).toBe(
      "/alumni?industry_group=other&secondary_industry_group=FP%26A",
    );
    const f = parseAlumniFilters(spOf(href));
    expect(f.industryGroup).toBe("other");
    expect(f.secondaryIndustryGroup).toEqual(["FP&A"]);
    // The list query and its CSV export carry the same group.
    expect(toAlumniPopulationParams(f).getAll("secondary_industry_group")).toEqual([
      "FP&A",
    ]);
    const e = toExportFilters(f);
    expect(e.industry_group).toBe("other");
    expect(e.secondary_industry_group).toEqual(["FP&A"]);
    expect(e.no_secondary_industry).toBe(false);
  });

  it("opens Other + no secondary industry for the blank row", () => {
    const href = otherIndustryHref({
      name: "No secondary industry",
      group: null,
      no_secondary: true,
      count: 7,
    });
    expect(href).toBe("/alumni?industry_group=other&no_secondary_industry=1");
    const f = parseAlumniFilters(spOf(href));
    expect(f.noSecondaryIndustry).toBe(true);
    expect(f.secondaryIndustryGroup).toEqual([]);
    expect(toAlumniPopulationParams(f).get("no_secondary_industry")).toBe("true");
    const e = toExportFilters(f);
    expect(e.no_secondary_industry).toBe(true);
    expect(e.secondary_industry_group).toBeNull();
  });
});
