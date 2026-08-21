import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { sortIndustryRows } from "@/lib/industryBreakdown";

/**
 * Ordering of the dashboard's Industry breakdown panel.
 *
 * The panel answers "who do we have the most of", so the biggest industry has
 * to be the top line. That is a property of the ORDER, which is invisible in a
 * diff and easy to lose to a later "tidy up the sort" — hence these.
 */

const DASHBOARD = "src/app/(app)/dashboard/page.tsx";
const read = (relPath: string): string =>
  readFileSync(resolve(process.cwd(), relPath), "utf8");

/** The counts, in rendered order. */
const counts = (rows: { label: string; count: number }[]) =>
  sortIndustryRows(rows).map((r) => r.count);

/** The labels, in rendered order. */
const labels = (rows: { label: string; count: number }[]) =>
  sortIndustryRows(rows).map((r) => r.label);

describe("sortIndustryRows", () => {
  it("orders strictly descending by count", () => {
    const rows = [
      { label: "Equity Research", count: 7 },
      { label: "Asset Management", count: 44 },
      { label: "Consulting", count: 24 },
      { label: "Investment Banking", count: 29 },
    ];
    expect(counts(rows)).toEqual([44, 29, 24, 7]);
    // Stated as the invariant, not just the example: every step down the list
    // is the same count or smaller, never larger.
    const seq = counts(rows);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeLessThanOrEqual(seq[i - 1]);
    }
  });

  it("does not depend on the order the API sent", () => {
    // Same four industries, three different arrival orders, one rendered order.
    const rows = [
      { label: "Consulting", count: 24 },
      { label: "Asset Management", count: 44 },
      { label: "Equity Research", count: 7 },
    ];
    const expected = ["Asset Management", "Consulting", "Equity Research"];
    expect(labels(rows)).toEqual(expected);
    expect(labels([...rows].reverse())).toEqual(expected);
    expect(labels([rows[1], rows[2], rows[0]])).toEqual(expected);
  });

  it("breaks ties on the label A→Z so equal counts never shuffle", () => {
    // Without the secondary sort the comparator returns 0 here and the order is
    // whatever the input happened to be — two renders, two different panels.
    const rows = [
      { label: "Venture Capital", count: 15 },
      { label: "Private Credit", count: 17 },
      { label: "Valuation & Advisory", count: 15 },
      { label: "Private Equity", count: 17 },
    ];
    const expected = [
      "Private Credit",
      "Private Equity",
      "Valuation & Advisory",
      "Venture Capital",
    ];
    expect(labels(rows)).toEqual(expected);
    expect(labels([...rows].reverse())).toEqual(expected);
  });

  it("keeps zero-count industries, ordered last (#397)", () => {
    // The backend lists every canonical industry precisely so an empty one is
    // visible as a real zero — "Financial Services" is the standing example.
    // Filtering zeros out would turn that answer back into an absence.
    const rows = [
      { label: "Financial Services", count: 0 },
      { label: "Asset Management", count: 44 },
      { label: "Sales", count: 0 },
      { label: "Real Estate", count: 7 },
    ];
    expect(labels(rows)).toEqual([
      "Asset Management",
      "Real Estate",
      "Financial Services",
      "Sales",
    ]);
    expect(sortIndustryRows(rows)).toHaveLength(4);
  });

  it("ranks the Other / Unknown / Graduate Student buckets by count too", () => {
    // They used to be pinned to the end regardless of size, which hid the case
    // that matters most: a catch-all bucket bigger than a real category.
    const rows = [
      { label: "Asset Management", count: 44 },
      { label: "Other", count: 60 },
      { label: "Unknown", count: 12 },
      { label: "Graduate Student", count: 0 },
      { label: "Real Estate", count: 7 },
    ];
    expect(labels(rows)).toEqual([
      "Other",
      "Asset Management",
      "Unknown",
      "Real Estate",
      "Graduate Student",
    ]);
  });

  it("carries the rest of the row through and leaves the input alone", () => {
    // Each row also holds the deep link the panel renders; a sort that rebuilt
    // rows instead of moving them would silently drop it.
    const rows = [
      { label: "Real Estate", count: 7, href: "/alumni?industry=Real%20Estate" },
      { label: "Consulting", count: 24, href: "/alumni?industry=Consulting" },
    ];
    const sorted = sortIndustryRows(rows);
    expect(sorted[0].href).toBe("/alumni?industry=Consulting");
    expect(rows[0].label).toBe("Real Estate");
  });

  it("handles the empty list", () => {
    expect(sortIndustryRows([])).toEqual([]);
  });
});

describe("the dashboard panel uses it", () => {
  const src = read(DASHBOARD);

  it("orders the list through the shared helper, not the API's order", () => {
    expect(src).toContain("sortIndustryRows(rows)");
  });

  it("no longer pins the catch-all buckets to the end", () => {
    expect(src).not.toContain("const PINNED");
  });

  it("scales the bars off the largest count in the sorted list", () => {
    // Read from the data, never from a row index — otherwise re-ordering
    // desynchronises the fills from the numbers beside them.
    expect(src).toContain("Math.max(1, ...ordered.map((r) => r.count))");
    expect(src).toContain("Math.round((r.count / max) * 100)");
  });

  it("keeps one line per industry, and SHRINKS rather than scrolling", () => {
    // One line per row is what made this list fit a laptop at all, and it
    // stands: the stacked two-line row cost ~30px each and needed ~540px.
    expect(src).toContain("lg:flex-1");

    // ⚠️ THIS NOW ASSERTS THE OPPOSITE OF WHAT IT USED TO (Jake, 2026-08-20).
    // It required `lg:overflow-y-auto` on the panel, on the reasoning that if
    // the list outgrew its box a scrollbar was more honest than rows silently
    // vanishing. Sound in general, wrong here: these rows are ELASTIC, so the
    // scrollbar appeared while every industry was still on screen, which reads
    // as broken rather than honest. The rows compress instead.
    expect(src).not.toContain("lg:overflow-y-auto");

    // The floor that makes compressing possible. It was 20px — which was the
    // row's NATURAL height (12px text on a 16px line, plus 2px of padding
    // either side), so it never actually compressed; it just overflowed. 14px
    // with the vertical padding removed is a real floor.
    expect(src).toContain("lg:min-h-[14px]");
    expect(src).toContain("lg:py-0");
  });
});
