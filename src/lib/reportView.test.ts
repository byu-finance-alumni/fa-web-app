import { describe, expect, it } from "vitest";

import {
  netTrekExportFilename,
  netTrekExportPath,
  netTrekReportApiPath,
  netTrekReportHref,
} from "./nettreks";
import {
  outreachExportFilename,
  outreachExportPath,
  outreachListApiPath,
  outreachListHref,
} from "./outreach";
import {
  DEFAULT_REPORT_VIEW,
  REPORT_FILTERS,
  cleanReportFilters,
  isReportFiltered,
  parseReportView,
  parseReportViewQuery,
  reportSortState,
  reportViewQuery,
  toggleReportSort,
  withReportView,
  type ReportView,
} from "./reportView";

const byCompany: ReportView = { ...DEFAULT_REPORT_VIEW, sort: "company", dir: "desc" };

describe("the sort in the URL", () => {
  it("reads a known column and direction", () => {
    expect(parseReportView({ sort: "company", dir: "desc" })).toEqual(byCompany);
    expect(parseReportView({ sort: ["company", "phone"] }).sort).toBe("company");
  });

  it("drops what the API would refuse", () => {
    expect(parseReportView({ sort: "willing_to_host", dir: "desc" })).toEqual(DEFAULT_REPORT_VIEW);
    expect(parseReportView({ sort: "toString" })).toEqual(DEFAULT_REPORT_VIEW);
    expect(parseReportView({ dir: "desc" })).toEqual(DEFAULT_REPORT_VIEW);
    expect(parseReportView({ sort: "company", dir: "up" }).dir).toBe("asc");
  });

  it("round-trips through a URL", () => {
    const url = new URL(withReportView("/x", byCompany), "http://t");
    expect(parseReportView(Object.fromEntries(url.searchParams))).toEqual(byCompany);
  });

  it("keeps the default URL clean and adds to an existing query", () => {
    expect(withReportView("/x", DEFAULT_REPORT_VIEW)).toBe("/x");
    expect(withReportView("/x?industry=Sales", byCompany)).toBe(
      "/x?industry=Sales&sort=company&dir=desc",
    );
  });
});

describe("clicking a header", () => {
  it("starts a new column ascending, then flips it", () => {
    const asc = toggleReportSort(DEFAULT_REPORT_VIEW, "company");
    expect(asc).toMatchObject({ sort: "company", dir: "asc" });
    expect(toggleReportSort(asc, "company")).toMatchObject({ sort: "company", dir: "desc" });
    expect(toggleReportSort(byCompany, "company")).toMatchObject({ sort: "company", dir: "asc" });
  });

  it("treats the default as last name ascending, and returns to it cleanly", () => {
    expect(reportSortState(DEFAULT_REPORT_VIEW, "last_name")).toEqual({ active: true, dir: "asc" });
    const desc = toggleReportSort(DEFAULT_REPORT_VIEW, "last_name");
    expect(desc).toMatchObject({ sort: "last_name", dir: "desc" });
    expect(toggleReportSort(desc, "last_name")).toEqual(DEFAULT_REPORT_VIEW);
  });
});

describe("the list URLs carry the view", () => {
  it("through paging", () => {
    expect(netTrekReportHref("dallas", "hosts", 50, byCompany)).toBe(
      "/nettreks/dallas/hosts?sort=company&dir=desc&offset=50",
    );
    expect(outreachListHref("mentors", "industry", "Sales", 50, byCompany)).toBe(
      "/outreach/mentors/industry?industry=Sales&sort=company&dir=desc&offset=50",
    );
  });

  it("to the API", () => {
    expect(netTrekReportApiPath("dallas", "hosts", 0, byCompany)).toBe(
      "/nettreks/dallas/hosts?limit=50&offset=0&sort=company&dir=desc",
    );
    expect(outreachListApiPath("speakers", "utah", null, 0, byCompany)).toBe(
      "/outreach/speakers/utah?limit=50&offset=0&sort=company&dir=desc",
    );
  });
});

describe("the filters in the URL", () => {
  it("covers every column but nothing else, in column order", () => {
    expect(REPORT_FILTERS.map((f) => f.label)).toEqual([
      "First",
      "Middle",
      "Last",
      "Company",
      "Industry",
      "Secondary",
      "City",
      "State",
      "Personal email",
      "Work email",
      "Phone",
      "LinkedIn",
      "Gender",
      "Grad",
    ]);
  });

  it("uses dropdowns for exactly the columns Jake named", () => {
    expect(REPORT_FILTERS.filter((f) => f.options).map((f) => f.label)).toEqual([
      "Industry",
      "Secondary",
      "State",
      "Gender",
      "Grad",
    ]);
  });

  it("reads and writes the filters, encoded", () => {
    const view: ReportView = {
      sort: "company",
      dir: "asc",
      filters: { f_last_name: "O'Neil & Co", f_graduation_year: "2015", f_gender: "F" },
    };
    const url = new URL(withReportView("/x", view), "http://t");
    expect(url.search).toContain("f_last_name=O%27Neil+%26+Co");
    expect(parseReportView(Object.fromEntries(url.searchParams))).toEqual(view);
  });

  it("drops what the API would refuse, so a bad link still loads", () => {
    const { filters } = parseReportView({
      f_last_name: "x".repeat(101),
      f_company: "a\nb",
      f_gender: "X",
      f_graduation_year: "20155",
      f_industry: "  ",
      f_phone: ["801", "999"],
      f_nonsense: "1",
    });
    expect(filters).toEqual({ f_phone: "801" });
  });

  it("keeps a year the API allows and refuses one it does not", () => {
    expect(cleanReportFilters({ f_graduation_year: "0" })).toEqual({});
    expect(cleanReportFilters({ f_graduation_year: "1999" })).toEqual({
      f_graduation_year: "1999",
    });
  });

  it("knows when a list is filtered", () => {
    expect(isReportFiltered(DEFAULT_REPORT_VIEW)).toBe(false);
    expect(isReportFiltered({ ...DEFAULT_REPORT_VIEW, filters: { f_phone: "1" } })).toBe(true);
  });
});

describe("paging a filtered, sorted list", () => {
  const view: ReportView = { sort: "company", dir: "desc", filters: { f_company: "acme" } };

  it("keeps both on the page URL and the API call", () => {
    expect(netTrekReportHref("dallas", "hosts", 50, view)).toBe(
      "/nettreks/dallas/hosts?sort=company&dir=desc&f_company=acme&offset=50",
    );
    expect(outreachListApiPath("mentors", "industry", "Sales", 50, view)).toBe(
      "/outreach/mentors/industry?industry=Sales&limit=50&offset=50&sort=company&dir=desc&f_company=acme",
    );
  });

  it("a new sort keeps the filters and returns to page one", () => {
    const next = toggleReportSort(view, "phone");
    expect(netTrekReportHref("dallas", "hosts", 0, next)).toBe(
      "/nettreks/dallas/hosts?sort=phone&f_company=acme",
    );
  });
});

describe("the export", () => {
  const view: ReportView = { sort: "phone", dir: "desc", filters: { f_gender: "F" } };

  it("sends the page's sort and filters, or nothing for the whole list", () => {
    expect(netTrekExportPath("dallas", "hosts", view)).toBe(
      "/nettreks/dallas/hosts/export?sort=phone&dir=desc&f_gender=F",
    );
    expect(netTrekExportPath("dallas", "hosts")).toBe("/nettreks/dallas/hosts/export");
    expect(outreachExportPath("mentors", "industry", "Sales", view)).toBe(
      "/outreach/mentors/industry/export?industry=Sales&sort=phone&dir=desc&f_gender=F",
    );
  });

  it("names a filtered fallback file like the backend does", () => {
    const day = new Date("2026-11-04T12:00:00Z");
    expect(netTrekExportFilename("new_york", "hosts", day, true)).toBe(
      "new_york_nettrek_hosts_filtered_2026-11-04.csv",
    );
    expect(outreachExportFilename("mentors", "industry", "Sales", day, true)).toBe(
      "mentors_industry_sales_filtered_2026-11-04.csv",
    );
  });

  it("re-checks the view a server action receives", () => {
    expect(parseReportViewQuery(reportViewQuery(view))).toEqual(view);
    expect(parseReportViewQuery("sort=evil&f_gender=X&f_nope=1")).toEqual(DEFAULT_REPORT_VIEW);
    expect(parseReportViewQuery({ sort: "phone" })).toEqual(DEFAULT_REPORT_VIEW);
    expect(parseReportViewQuery(undefined)).toEqual(DEFAULT_REPORT_VIEW);
  });
});
