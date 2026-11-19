import { describe, expect, it } from "vitest";
import {
  applyChoice,
  detectAttendeeListKind,
  headerKey,
  candidateLabel,
  choiceCounts,
  choiceValue,
  draftFromRow,
  draftProblem,
  toCommitRow,
  toCommitRows,
} from "@/lib/attendeeSheet";
import type { SheetPreviewRow } from "@/types/attendee-sheet";

function row(over: Partial<SheetPreviewRow> = {}): SheetPreviewRow {
  return {
    row: 2,
    first_name: "Jane",
    last_name: "Doe",
    company: "Goldman",
    role: "Analyst",
    email: "jane@x.org",
    focus: "Fin",
    ug: "BYU",
    ug_year: 2019,
    linkedin: null,
    grad: null,
    grad_year: null,
    net_id: null,
    status: "new_alumni",
    action: "new_alumni",
    alumni_id: null,
    candidates: [],
    warnings: [],
    ...over,
  };
}

describe("attendee sheet drafts", () => {
  it("a matched row commits only its id", () => {
    const d = draftFromRow(row({ status: "matched", action: "match", alumni_id: 42 }));
    expect(toCommitRow(2, d)).toMatchObject({
      row: 2,
      action: "match",
      alumni_id: 42,
      first_name: null,
    });
  });

  it("a new row commits the edited values", () => {
    const d = { ...draftFromRow(row()), first_name: " Janet ", ug_year: "2020" };
    expect(toCommitRow(2, d)).toMatchObject({
      action: "new_alumni",
      first_name: "Janet",
      last_name: "Doe",
      ug_year: 2020,
      grad_year: null,
      email: "jane@x.org",
    });
  });

  it("switching the choice changes action and match", () => {
    const d = draftFromRow(row());
    const matched = applyChoice(d, "match:7");
    expect(matched).toMatchObject({ action: "match", alumni_id: 7 });
    expect(choiceValue(matched)).toBe("match:7");
    expect(applyChoice(matched, "new_friend")).toMatchObject({
      action: "new_friend",
      alumni_id: null,
    });
  });

  it("an ambiguous row cannot be saved until a record is picked", () => {
    const d = draftFromRow(row({ status: "ambiguous", action: "match" }));
    expect(draftProblem(d)).toBe("Pick a record.");
    expect(draftProblem(applyChoice(d, "match:3"))).toBeNull();
    expect(draftProblem(applyChoice(d, "skip"))).toBeNull();
  });

  it("new records need both names and real years", () => {
    const d = draftFromRow(row());
    expect(draftProblem({ ...d, last_name: " " })).toMatch(/name/);
    expect(draftProblem({ ...d, ug_year: "'19" })).toMatch(/UG YR/);
    expect(draftProblem(d)).toBeNull();
  });

  it("builds every row and counts choices", () => {
    const rows = [row(), row({ row: 3, action: "skip", status: "invalid" })];
    const out = toCommitRows(rows, {});
    expect(out.map((r) => r.action)).toEqual(["new_alumni", "skip"]);
    expect(choiceCounts(rows.map(draftFromRow))).toEqual({
      match: 0,
      new_alumni: 1,
      new_friend: 0,
      skip: 1,
    });
  });

  it("labels candidates with years, employer and friend id", () => {
    expect(
      candidateLabel({
        alumni_id: 60,
        name: "Sam Lee",
        graduation_year: null,
        graduate_graduation_year: null,
        is_alumni: false,
        friend_id: "FRIEND-00060",
        current_employer: "Acme",
      }),
    ).toBe("Sam Lee (Acme, FRIEND-00060)");
  });
});

describe("detectAttendeeListKind", () => {
  it("routes the meeting's sign-up sheet to the sheet import", () => {
    const csv =
      "Fname,Lname,Company,Role,Email,Focus,UG,UG YR,LinkedIn,Grad,GradYR\nA,B,C,D,e@x.com,Fin,BYU,2015,,MBA,2019\n";
    expect(detectAttendeeListKind(csv)).toBe("sheet");
  });

  it("accepts a BOM, quotes, CRLF and extra columns", () => {
    const csv = '﻿"First Name","Last Name","Grad Year","Shirt, size"\r\nA,B,2019,M\r\n';
    expect(detectAttendeeListKind(csv)).toBe("sheet");
  });

  it("sends a list with no grad-year column to the matcher", () => {
    expect(detectAttendeeListKind("First Name,Last Name,Email,Company\n")).toBe("match");
  });

  it("sends a combined Name column or Net ID list to the matcher", () => {
    expect(detectAttendeeListKind("Name,E-mail Address,Organization\n")).toBe("match");
    expect(detectAttendeeListKind("Net ID\nabc12\n")).toBe("match");
  });

  it("does not read a year column from the data rows", () => {
    expect(detectAttendeeListKind("Fname,Lname,Email\nGradYR,x,y\n")).toBe("match");
  });

  it("headerKey collapses punctuation like the backend", () => {
    expect(headerKey("  UG-YR ")).toBe("ug yr");
    expect(headerKey("﻿Fname")).toBe("fname");
  });
});
