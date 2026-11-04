import { describe, expect, it } from "vitest";

import { netTrekReportApiPath, netTrekReportHref } from "./nettreks";
import { outreachListApiPath, outreachListHref } from "./outreach";
import {
  DEFAULT_REPORT_VIEW,
  parseReportView,
  reportSortState,
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
