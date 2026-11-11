import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getVisibleNav, leafHrefs, NAV } from "@/components/shell/nav";
import { ROLE } from "@/constants/roles";
import {
  netTrekDisplayName,
  netTrekExportFilename,
  netTrekReportApiPath,
  netTrekReportExists,
  netTrekReportHref,
  parseNetTrekOffset,
  type NetTrekAreaSummary,
  type NetTrekRow,
} from "@/lib/nettreks";
import {
  DEFAULT_REPORT_VIEW,
  withReportView,
  type ReportFilterOptions,
} from "@/lib/reportView";
import { NetTrekReportLinks } from "./NetTrekReportLinks";
import { ReportBackButton } from "./ReportBackButton";
import { clickOpensRow } from "./ReportRow";
import { ReportFiltersBar } from "./ReportFiltersBar";
import {
  NETTREK_SCREEN_COLUMNS,
  NETTREK_TABLE_COLUMNS,
  NetTrekReportTable,
} from "./NetTrekReportTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  // Profile links read the current URL to carry it as `?from=` (#937).
  usePathname: () => "/nettreks/dallas/hosts",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * NetTreks tab (#887): nav visibility by capability, the landing page's report
 * links and counts, and the report table — rendered with react-dom/server (no
 * DOM; see vitest.config.ts).
 */

/* -------------------------------------------------------------- nav ---- */

describe("NetTreks nav entry", () => {
  const hrefs = (caps: string[], role: string = ROLE.STUDENT) =>
    getVisibleNav(role, false, caps).flatMap(leafHrefs);

  it("shares the Outreach menu with Events, the event entries kept together", () => {
    const outreach = NAV.find((i) => i.label === "Outreach");
    expect(outreach?.children?.map((c) => c.label)).toEqual([
      "Events",
      "Event Speakers",
      "Event Sponsors",
      "Conference Interest",
      "NetTreks",
      "Alumni Mentors",
    ]);
    expect(NAV.some((i) => i.label === "Events" || i.label === "NetTreks")).toBe(false);
  });

  it("keeps Outreach (and Events) for a role without alumni.export", () => {
    const visible = getVisibleNav(ROLE.VIEW_ONLY, false);
    const outreach = visible.find((i) => i.label === "Outreach");
    expect(outreach?.children?.map((c) => c.label)).toEqual(["Events"]);
  });

  it("shows for a holder of alumni.export", () => {
    expect(hrefs(["view", "alumni.export"])).toContain("/nettreks");
  });

  it("is hidden without alumni.export, whatever the role", () => {
    expect(hrefs(["view"])).not.toContain("/nettreks");
    expect(hrefs(["view", "alumni.edit"], ROLE.SUPER_ADMIN)).not.toContain(
      "/nettreks",
    );
    // The safe default: no capability list hides it.
    expect(getVisibleNav(ROLE.VIEW_ONLY, false).flatMap(leafHrefs)).not.toContain(
      "/nettreks",
    );
  });
});

/* -------------------------------------------------------- helpers ---- */

describe("NetTreks helpers", () => {
  it("Other has only a Hosts report", () => {
    expect(netTrekReportExists("other", "hosts")).toBe(true);
    expect(netTrekReportExists("other", "area_alumni")).toBe(false);
    expect(netTrekReportExists("wasatch", "area_alumni")).toBe(true);
  });

  it("builds the page and API URLs", () => {
    expect(netTrekReportHref("dallas", "hosts")).toBe("/nettreks/dallas/hosts");
    expect(netTrekReportHref("dallas", "area_alumni", 50)).toBe(
      "/nettreks/dallas/area_alumni?offset=50",
    );
    expect(netTrekReportApiPath("seattle", "hosts", 100)).toBe(
      "/nettreks/seattle/hosts?limit=50&offset=100",
    );
  });

  it("reads only a whole-number offset", () => {
    expect(parseNetTrekOffset("100")).toBe(100);
    expect(parseNetTrekOffset(undefined)).toBe(0);
    expect(parseNetTrekOffset("-5")).toBe(0);
    expect(parseNetTrekOffset("1e3")).toBe(0);
    expect(parseNetTrekOffset(["50", "9"])).toBe(50);
  });

  it("names the fallback file like the backend does", () => {
    const day = new Date("2026-10-28T12:00:00Z");
    expect(netTrekExportFilename("dallas", "hosts", day)).toBe(
      "dallas_nettrek_hosts_2026-10-28.csv",
    );
    expect(netTrekExportFilename("dallas", "area_alumni", day)).toBe(
      "dallas_area_alumni_2026-10-28.csv",
    );
  });
});

/* -------------------------------------------------------- landing ---- */

function area(
  key: NetTrekAreaSummary["key"],
  name: string,
  hosts: number,
  alumni: number | null,
): NetTrekAreaSummary {
  return {
    key,
    name,
    hosts: { kind: "hosts", title: `${name} NetTrek Hosts`, count: hosts },
    area_alumni:
      alumni === null
        ? null
        : { kind: "area_alumni", title: `${name} Area Alumni`, count: alumni },
  };
}

describe("NetTreks landing links", () => {
  const html = renderToStaticMarkup(
    createElement(NetTrekReportLinks, {
      areas: [
        area("dallas", "Dallas", 4, 1234),
        area("wasatch", "Wasatch", 12, 2900),
        area("other", "Other", 7, null),
      ],
    }),
  );

  it("links every report with its count", () => {
    expect(html).toContain('href="/nettreks/dallas/hosts"');
    expect(html).toContain("Dallas NetTrek Hosts");
    expect(html).toContain('href="/nettreks/dallas/area_alumni"');
    expect(html).toContain("Dallas Area Alumni");
    expect(html).toContain("(1,234)");
    expect(html).toContain('href="/nettreks/wasatch/area_alumni"');
    expect(html).toContain("(2,900)");
  });

  it("gives Other a Hosts link and no Area Alumni link", () => {
    expect(html).toContain('href="/nettreks/other/hosts"');
    expect(html).toContain("Other NetTrek Hosts");
    expect(html).toContain("(7)");
    expect(html).not.toContain("/nettreks/other/area_alumni");
    expect(html).not.toContain("Other Area Alumni");
  });

  it("renders no icons", () => {
    expect(html).not.toContain("<svg");
  });
});

/* ---------------------------------------------------------- table ---- */

function row(over: Partial<NetTrekRow>): NetTrekRow {
  return {
    alumni_id: 1,
    first_name: "Jane",
    middle_name: null,
    last_name: "Doe",
    company: "Goldman Sachs",
    industry: "Investment Banking",
    secondary_industry: null,
    company_city: "Dallas",
    company_state: "Texas",
    permanent_email: "jane@dev.example",
    work_email: null,
    phone: "555-0100",
    linkedin_url: "https://www.linkedin.com/in/jane",
    gender: "F",
    graduation_year: 2015,
    ...over,
  };
}

const headers = (html: string) =>
  [...html.matchAll(/<th\s[^>]*>(?:<a[^>]*><span[^>]*>)?([^<]*)</g)].map((m) => m[1]);

const table = (
  rows: NetTrekRow[],
  over: Partial<Parameters<typeof NetTrekReportTable>[0]> = {},
) =>
  renderToStaticMarkup(
    createElement(NetTrekReportTable, {
      rows,
      view: DEFAULT_REPORT_VIEW,
      viewHref: (v) => withReportView("/nettreks/dallas/hosts", v),
      canSeeGender: true,
      ...over,
    }),
  );

describe("NetTrek report table", () => {
  it("has the issue's columns, in order", () => {
    const html = table([row({})]);
    // Short screen labels, one per CSV column and in the same order; each
    // header's hover text is the full CSV name.
    expect(headers(html)).toEqual(NETTREK_SCREEN_COLUMNS.map((c) => c.label));
    for (const name of NETTREK_TABLE_COLUMNS) expect(html).toContain(`title="${name}"`);
    const pct = NETTREK_SCREEN_COLUMNS.reduce((n, c) => n + Number(c.w.match(/\d+/)![0]), 0);
    expect(pct).toBe(100);
    expect(NETTREK_TABLE_COLUMNS).toEqual([
      "First Name",
      "Middle Name",
      "Last Name",
      "Company",
      "Industry",
      "Secondary Industry",
      "Company City",
      "Company State",
      "Permanent Email",
      "Work Email",
      "Phone",
      "LinkedIn URL",
      "Gender",
      "Graduation Year",
    ]);
  });

  it("renders a row, linking the name to the profile", () => {
    const html = table([row({ alumni_id: 42 })]);
    expect(html).toContain('href="/alumni/42?from=%2Fnettreks%2Fdallas%2Fhosts"');
    expect(html).toContain("Goldman Sachs");
    expect(html).toContain("jane@dev.example");
    expect(html).toContain('href="https://www.linkedin.com/in/jane"');
    expect(html).not.toContain("Host");
  });

  it("shows a phone as the profile does, and an unknown one as stored", () => {
    const html = table([
      row({ alumni_id: 1, phone: "+1 8015551234" }),
      row({ alumni_id: 2, phone: "+44 20 7946 0958" }),
    ]);
    expect(html).toContain(">(801) 555-1234<");
    expect(html).toContain(">+44 20 7946 0958<");
  });

  it("never makes an unsafe LinkedIn value a link", () => {
    const html = table([row({ linkedin_url: "javascript:alert(1)" })]);
    expect(html).not.toContain('href="javascript:');
  });

  it("sorts on every column, in the alumni list's header style", () => {
    const html = table([row({})]);
    expect(html.match(/aria-sort=/g)?.length).toBe(NETTREK_SCREEN_COLUMNS.length);
    expect(html).toContain('href="/nettreks/dallas/hosts?sort=company"');
    // The default order is by last name, so that header is the active one and
    // a click reverses it.
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain('href="/nettreks/dallas/hosts?sort=last_name&amp;dir=desc"');
  });

  it("offers no gender sort to someone gender is hidden from", () => {
    const html = table([row({})], { canSeeGender: false });
    expect(html).not.toContain("sort=gender");
    expect(headers(html)).toContain("Gender");
    expect(html.match(/aria-sort=/g)?.length).toBe(NETTREK_SCREEN_COLUMNS.length - 1);
  });

  it("builds a display name from whatever name parts exist", () => {
    expect(netTrekDisplayName(row({ middle_name: "Q" }))).toBe("Jane Q Doe");
    expect(
      netTrekDisplayName(row({ first_name: null, last_name: null })),
    ).toBe("Unnamed alumnus");
  });
});

describe("Back", () => {
  it("is one visible text button naming the parent page", () => {
    const html = renderToStaticMarkup(
      createElement(ReportBackButton, { href: "/nettreks", label: "All NetTrek reports" }),
    );
    expect(html.match(/href="\/nettreks"/g)?.length).toBe(1);
    expect(html).toContain("Back to All NetTrek reports");
    expect(html.match(/<a /g)?.length).toBe(1);
    expect(html).not.toContain("<svg");
  });
});

describe("clicking a row", () => {
  const element = (inLink: boolean) =>
    ({ closest: () => (inLink ? {} : null) }) as unknown as Element;

  it("opens the profile from anywhere but a link", () => {
    expect(clickOpensRow(element(false), "")).toBe(true);
    expect(clickOpensRow(element(true), "")).toBe(false);
  });

  it("does not navigate when text was selected", () => {
    expect(clickOpensRow(element(false), "jane@dev.example")).toBe(false);
  });

  it("asks about links and controls", () => {
    const seen: string[] = [];
    clickOpensRow({ closest: (s: string) => (seen.push(s), null) } as unknown as Element, "");
    expect(seen[0].split(", ")).toEqual(["a", "button", "input", "select", "textarea"]);
  });

  it("has a pointer cursor and keeps the last name a real link", () => {
    const html = table([row({ alumni_id: 42 })]);
    expect(html).toContain('<tr class="cursor-pointer');
    expect(html).toContain('href="/alumni/42?from=%2Fnettreks%2Fdallas%2Fhosts"');
  });
});

describe("Outreach filters", () => {
  const options = {
    industry: ["Banking"],
    secondary_industry: [],
    company_state: ["TX", "UT"],
    gender: ["F", "M"],
    graduation_year: [2015],
  };
  const bar = (over: Partial<ReportFilterOptions> = {}, view = DEFAULT_REPORT_VIEW) =>
    renderToStaticMarkup(
      createElement(ReportFiltersBar, {
        path: "/x",
        view,
        options: { ...options, ...over },
        initialOpen: true,
      }),
    );

  it("starts closed, even on a filtered list, with the count on the button", () => {
    const closed = (view = DEFAULT_REPORT_VIEW) =>
      renderToStaticMarkup(
        createElement(ReportFiltersBar, { path: "/x", view, options }),
      );
    expect(closed()).not.toContain("<form");
    expect(closed()).toContain(">Filters<");
    const filtered = closed({ ...DEFAULT_REPORT_VIEW, filters: { f_company_state: "WY" } });
    expect(filtered).not.toContain("<form");
    expect(filtered).toContain("Filters (1)");
    expect(filtered).toContain("Clear filters");
  });

  it("has a control for every column, dropdowns offering the list's values", () => {
    const html = bar();
    expect(html.match(/<input/g)?.length).toBe(9);
    expect(html.match(/<select/g)?.length).toBe(5);
    expect(html).toContain('<option value="UT">UT</option>');
    expect(html).toContain('<option value="2015">2015</option>');
  });

  it("leaves Gender out for someone it is hidden from", () => {
    const html = bar({ gender: null });
    expect(html.match(/<select/g)?.length).toBe(4);
    expect(html).not.toContain("report-filter-f_gender");
    expect(html).not.toContain(">Gender<");
  });

  it("keeps a filter from the URL selectable, and offers Clear only when filtered", () => {
    expect(bar()).not.toContain("Clear filters");
    const html = bar({}, { ...DEFAULT_REPORT_VIEW, filters: { f_company_state: "WY" } });
    expect(html).toContain("Clear filters");
    expect(html).toMatch(/<option value="WY" selected="">WY<\/option>/);
  });

  it("renders no icons but the shared dropdown's", () => {
    expect(bar({}).match(/<svg/g)?.length).toBe(5);
  });
});
