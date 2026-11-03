import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IndustryBarList } from "@/components/shared/IndustryBarList";
import { getVisibleNav, leafHrefs } from "@/components/shell/nav";
import { ROLE } from "@/constants/roles";
import {
  cleanIndustry,
  isOutreachGroupKey,
  isOutreachListKey,
  mentorChartRows,
  outreachExportFilename,
  outreachExportPath,
  outreachListApiPath,
  outreachListExists,
  outreachListHref,
  showMentorChart,
  type OutreachListLink,
} from "@/lib/outreach";
import { OutreachListLinks } from "./OutreachListLinks";

/**
 * Outreach interest lists: nav visibility by capability, the URL scheme, the
 * landing links and the Alumni Mentors chart rule — rendered with
 * react-dom/server (no DOM; see vitest.config.ts), as the NetTreks tests are.
 */

const PAGES = [
  "/outreach/conference",
  "/outreach/speakers",
  "/outreach/sponsors",
  "/outreach/mentors",
];

/* -------------------------------------------------------------- nav ---- */

describe("Outreach list nav entries", () => {
  const hrefs = (caps: string[], role: string = ROLE.STUDENT) =>
    getVisibleNav(role, false, caps).flatMap(leafHrefs);

  it("show for a holder of alumni.export", () => {
    const visible = hrefs(["view", "alumni.export"]);
    for (const page of PAGES) expect(visible).toContain(page);
  });

  it("are hidden without alumni.export, whatever the role", () => {
    for (const visible of [
      hrefs(["view"]),
      hrefs(["view", "alumni.edit"], ROLE.SUPER_ADMIN),
      getVisibleNav(ROLE.VIEW_ONLY, false).flatMap(leafHrefs),
    ]) {
      for (const page of PAGES) expect(visible).not.toContain(page);
    }
  });
});

/* -------------------------------------------------------- helpers ---- */

describe("Outreach helpers", () => {
  it("knows which lists each page has", () => {
    expect(outreachListExists("conference", "real_estate", null)).toBe(true);
    expect(outreachListExists("conference", "utah", null)).toBe(false);
    expect(outreachListExists("sponsors", "out_of_state", null)).toBe(true);
    expect(outreachListExists("mentors", "women", null)).toBe(true);
    // An industry list needs an industry, and nothing else takes one.
    expect(outreachListExists("mentors", "industry", "Sales")).toBe(true);
    expect(outreachListExists("mentors", "industry", null)).toBe(false);
    expect(outreachListExists("mentors", "women", "Sales")).toBe(false);
  });

  it("checks keys", () => {
    expect(isOutreachGroupKey("mentors")).toBe(true);
    expect(isOutreachGroupKey("nettreks")).toBe(false);
    expect(isOutreachGroupKey("toString")).toBe(false);
    expect(isOutreachListKey("out_of_state")).toBe(true);
    expect(isOutreachListKey("everyone")).toBe(false);
  });

  it("reads a blank industry as none", () => {
    expect(cleanIndustry("  Sales ")).toBe("Sales");
    expect(cleanIndustry("   ")).toBeNull();
    expect(cleanIndustry(undefined)).toBeNull();
    expect(cleanIndustry(["Sales", "x"])).toBe("Sales");
  });

  it("builds the page, API and CSV URLs", () => {
    expect(outreachListHref("speakers", "utah")).toBe("/outreach/speakers/utah");
    expect(outreachListHref("speakers", "utah", null, 50)).toBe(
      "/outreach/speakers/utah?offset=50",
    );
    expect(outreachListHref("mentors", "industry", "Valuation & Advisory", 50)).toBe(
      "/outreach/mentors/industry?industry=Valuation+%26+Advisory&offset=50",
    );
    expect(outreachListApiPath("conference", "real_estate", null, 100)).toBe(
      "/outreach/conference/real_estate?limit=50&offset=100",
    );
    expect(outreachExportPath("mentors", "industry", "Sales")).toBe(
      "/outreach/mentors/industry/export?industry=Sales",
    );
  });

  it("names the fallback file like the backend does", () => {
    const day = new Date("2026-11-03T12:00:00Z");
    expect(outreachExportFilename("speakers", "out_of_state", null, day)).toBe(
      "speakers_out_of_state_2026-11-03.csv",
    );
    expect(outreachExportFilename("mentors", "industry", "Valuation & Advisory", day)).toBe(
      "mentors_industry_valuation_advisory_2026-11-03.csv",
    );
  });
});

/* -------------------------------------------------------- landing ---- */

const industry = (name: string, count: number): OutreachListLink => ({
  key: "industry",
  industry: name,
  title: `${name} Mentors`,
  count,
});
const notListed = (count: number): OutreachListLink => ({
  key: "no_industry",
  industry: null,
  title: "Industry Not Listed Mentors",
  count,
});
const women = (count: number): OutreachListLink => ({
  key: "women",
  industry: null,
  title: "Alumni Mentors for Women",
  count,
});

describe("Outreach landing links", () => {
  const html = renderToStaticMarkup(
    createElement(OutreachListLinks, {
      group: "mentors",
      heading: "Mentors by industry",
      links: [industry("Investment Banking", 8), notListed(2), women(1234)],
    }),
  );

  it("links every list with its count", () => {
    expect(html).toContain(
      'href="/outreach/mentors/industry?industry=Investment+Banking"',
    );
    expect(html).toContain("Investment Banking Mentors");
    expect(html).toContain("(8)");
    expect(html).toContain('href="/outreach/mentors/no_industry"');
    expect(html).toContain("Industry Not Listed Mentors");
    expect(html).toContain('href="/outreach/mentors/women"');
    expect(html).toContain("(1,234)");
  });

  it("renders no icons", () => {
    expect(html).not.toContain("<svg");
  });
});

/* ------------------------------------------------- mentors chart ---- */

describe("Alumni Mentors chart", () => {
  it("needs at least 10 mentors across at least 3 industries", () => {
    const three = [industry("A", 4), industry("B", 3), industry("C", 3)];
    expect(showMentorChart(three)).toBe(true);
    expect(showMentorChart([industry("A", 4), industry("B", 3), industry("C", 2)])).toBe(
      false,
    );
    // Plenty of mentors but only two industries.
    expect(showMentorChart([industry("A", 40), industry("B", 30)])).toBe(false);
    // Industry Not Listed counts toward the total, not the industries.
    expect(
      showMentorChart([industry("A", 3), industry("B", 3), industry("C", 3), notListed(1)]),
    ).toBe(true);
    expect(
      showMentorChart([industry("A", 3), industry("B", 3), notListed(20)]),
    ).toBe(false);
    // Women's mentors are a separate list and count for neither.
    expect(
      showMentorChart([industry("A", 3), industry("B", 3), industry("C", 3), women(50)]),
    ).toBe(false);
  });

  it("draws one bar per industry, linking to its list", () => {
    const rows = mentorChartRows([industry("Sales", 5), notListed(2), women(9)]);
    expect(rows).toEqual([
      { label: "Sales", count: 5, href: "/outreach/mentors/industry?industry=Sales" },
      { label: "Industry Not Listed", count: 2, href: "/outreach/mentors/no_industry" },
    ]);
    const html = renderToStaticMarkup(
      createElement(IndustryBarList, {
        rows,
        emptyLabel: "No mentors yet.",
        linkLabel: (r) => `View ${r.label} mentors (${r.count})`,
      }),
    );
    expect(html).toContain('aria-label="View Sales mentors (5)"');
    expect(html).toContain('href="/outreach/mentors/no_industry"');
    expect(html).not.toContain("<svg");
  });
});
