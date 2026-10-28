import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

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
import { NetTrekReportLinks } from "./NetTrekReportLinks";
import { NETTREK_TABLE_COLUMNS, NetTrekReportTable } from "./NetTrekReportTable";

/**
 * NetTreks tab (#887): nav visibility by capability, the landing page's report
 * links and counts, and the report table — rendered with react-dom/server (no
 * DOM; see vitest.config.ts).
 */

/* -------------------------------------------------------------- nav ---- */

describe("NetTreks nav entry", () => {
  const hrefs = (caps: string[], role: string = ROLE.STUDENT) =>
    getVisibleNav(role, false, caps).flatMap(leafHrefs);

  it("shares the Outreach menu with Events, NetTreks right after Events", () => {
    const outreach = NAV.find((i) => i.label === "Outreach");
    expect(outreach?.children?.map((c) => c.label)).toEqual(["Events", "NetTreks"]);
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
    willing_to_host: true,
    ...over,
  };
}

const headers = (html: string) =>
  [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);

describe("NetTrek report table", () => {
  it("has the issue's columns, in order", () => {
    const html = renderToStaticMarkup(
      createElement(NetTrekReportTable, { rows: [row({})] }),
    );
    expect(headers(html)).toEqual([...NETTREK_TABLE_COLUMNS]);
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
      "Willing to Host a NetTrek",
    ]);
  });

  it("renders a row, linking the name to the profile", () => {
    const html = renderToStaticMarkup(
      createElement(NetTrekReportTable, {
        rows: [row({ alumni_id: 42 }), row({ alumni_id: 43, willing_to_host: false })],
      }),
    );
    expect(html).toContain('href="/alumni/42"');
    expect(html).toContain("Goldman Sachs");
    expect(html).toContain("jane@dev.example");
    expect(html).toContain('href="https://www.linkedin.com/in/jane"');
    // Willing to host: "Yes" or blank.
    expect(html.match(/>Yes</g)?.length).toBe(1);
  });

  it("never makes an unsafe LinkedIn value a link", () => {
    const html = renderToStaticMarkup(
      createElement(NetTrekReportTable, {
        rows: [row({ linkedin_url: "javascript:alert(1)" })],
      }),
    );
    expect(html).not.toContain('href="javascript:');
  });

  it("builds a display name from whatever name parts exist", () => {
    expect(netTrekDisplayName(row({ middle_name: "Q" }))).toBe("Jane Q Doe");
    expect(
      netTrekDisplayName(row({ first_name: null, last_name: null })),
    ).toBe("Unnamed alumnus");
  });
});
