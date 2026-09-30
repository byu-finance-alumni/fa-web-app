import { describe, expect, it } from "vitest";
import {
  fillTimeResponders,
  isExportableYear,
  noReplyExportErrorMessage,
  noReplyExportFilename,
  noReplyExportPath,
  RESPONDER_KIND_LABEL,
  respondersDriftNote,
  respondersFor,
  respondersRequestPath,
  type SurveyResponders,
} from "./responders";

const data: SurveyResponders = {
  replied: [
    { alumni_id: 2, name: "Ann Adams", fill_seconds: null },
    { alumni_id: 1, name: "Yo Young", fill_seconds: null },
  ],
  confirmed: [{ alumni_id: 2, name: "Ann Adams", fill_seconds: null }],
};

/** A replier carrying `fill_seconds` (now a real field on `SurveyResponder`). */
function replier(
  alumni_id: number,
  name: string,
  fillSeconds: number | null,
): SurveyResponders["replied"][number] {
  return { alumni_id, name, fill_seconds: fillSeconds };
}

describe("responder names (#836)", () => {
  it("asks one endpoint per year for both lists", () => {
    expect(respondersRequestPath(2019)).toBe(
      "/survey/schedules/2019/responders",
    );
  });

  it("reads the list that matches the column", () => {
    expect(respondersFor(data, "replied").map((p) => p.alumni_id)).toEqual([
      2, 1,
    ]);
    expect(respondersFor(data, "confirmed").map((p) => p.alumni_id)).toEqual([
      2,
    ]);
  });

  it("titles each panel with its column heading", () => {
    // `confirmed` is the API's name; staff read "Looks good".
    expect(RESPONDER_KIND_LABEL.confirmed).toBe("Looks good");
    expect(RESPONDER_KIND_LABEL.replied).toBe("Replied");
  });

  it("says nothing when the names match the count", () => {
    expect(respondersDriftNote(2, 2)).toBe("");
  });

  it("says so when a reply landed after the table loaded", () => {
    const note = respondersDriftNote(3, 2);
    expect(note).toContain("3");
    expect(note).toContain("2");
    expect(note).toContain("Reload");
  });
});

describe("median-hover fill times (#543 follow-on)", () => {
  const timed: SurveyResponders = {
    replied: [
      replier(1, "Yo Young", 200),
      replier(2, "Ann Adams", null), // confirmed / no timer — dropped
      replier(3, "Bo Baker", 45),
    ],
    confirmed: [],
  };

  it("lists only repliers with a recorded time, longest first", () => {
    expect(fillTimeResponders(timed)).toEqual([
      { alumni_id: 1, name: "Yo Young", fillSeconds: 200 },
      { alumni_id: 3, name: "Bo Baker", fillSeconds: 45 },
    ]);
  });

  it("drops a replier whose time is null", () => {
    expect(
      fillTimeResponders(timed).map((p) => p.alumni_id),
    ).not.toContain(2);
  });

  it("is empty when no replier has a time yet (the common early case)", () => {
    // The pre-regen list carries no `fill_seconds` at all: read defensively, it
    // is simply nobody with a recorded time.
    expect(fillTimeResponders(data)).toEqual([]);
  });
});

describe("no-reply export (#836)", () => {
  it("has a per-year path and an all-years path", () => {
    expect(noReplyExportPath(2019)).toBe(
      "/survey/schedules/2019/no-reply/export",
    );
    expect(noReplyExportPath(null)).toBe("/survey/schedules/no-reply/export");
  });

  it("falls back to the backend's own dated filename", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    expect(noReplyExportFilename(2019, now)).toBe(
      "survey_no_reply_2019_2026-09-23.csv",
    );
    expect(noReplyExportFilename(null, now)).toBe(
      "survey_no_reply_all_2026-09-23.csv",
    );
  });

  it("only accepts a whole year in the API's range", () => {
    expect(isExportableYear(2019)).toBe(true);
    expect(isExportableYear(1900)).toBe(true); // the test cohort
    expect(isExportableYear(2100)).toBe(true);
    expect(isExportableYear(1899)).toBe(false);
    expect(isExportableYear(2101)).toBe(false);
    expect(isExportableYear(2019.5)).toBe(false);
    expect(isExportableYear("2019")).toBe(false);
    expect(isExportableYear(Number.NaN)).toBe(false);
  });

  it("explains each failure in a sentence someone can act on", () => {
    expect(noReplyExportErrorMessage(401)).toContain("Sign in again");
    expect(noReplyExportErrorMessage(403)).toContain("survey access");
    expect(noReplyExportErrorMessage(404)).toContain("Reload");
    expect(noReplyExportErrorMessage(429)).toContain("Wait");
    expect(noReplyExportErrorMessage(null)).toContain("no file was downloaded");
    expect(noReplyExportErrorMessage(500)).toContain("no file was downloaded");
  });
});
