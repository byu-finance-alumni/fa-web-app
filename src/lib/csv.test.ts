import { describe, expect, it } from "vitest";

import { FORMULA_LEAD_RE, csvLine, csvSafeCell, parseCsv, toCsv } from "@/lib/csv";

describe("csvSafeCell — formula-injection guard", () => {
  // The whole point: a rejected row came from a file we did not write, so any
  // cell in it is attacker-influenced by the time it reaches a staff download.
  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "neutralises a cell starting with %j",
    (lead) => {
      expect(csvSafeCell(`${lead}cmd|'/c calc'!A0`)).toBe(
        `\t${lead}cmd|'/c calc'!A0`,
      );
    },
  );

  it("neutralises the leading-whitespace bypass a char-0 test misses", () => {
    expect(csvSafeCell(" =1+1")).toBe("\t =1+1");
    expect(csvSafeCell("\n@SUM(A1)")).toBe("\t\n@SUM(A1)");
  });

  it("neutralises the classic DDE and hyperlink payloads", () => {
    expect(csvSafeCell('=HYPERLINK("http://evil.test","click")')).toMatch(
      /^\t=/,
    );
    expect(csvSafeCell("@SUM(1+9)*cmd|' /C calc'!A0")).toMatch(/^\t@/);
    expect(csvSafeCell("+cmd|' /C notepad'!'A1'")).toMatch(/^\t\+/);
    expect(csvSafeCell("-2+3+cmd|' /C calc'!A0")).toMatch(/^\t-/);
  });

  it("leaves ordinary values completely alone", () => {
    for (const value of [
      "Jane Doe",
      "1234",
      "jsmith@byu.edu",
      "Goldman Sachs & Co.",
      "",
    ]) {
      expect(csvSafeCell(value)).toBe(value);
    }
  });

  it("renders null and undefined as an empty cell, not the word", () => {
    expect(csvSafeCell(null)).toBe("");
    expect(csvSafeCell(undefined)).toBe("");
  });

  it("guards a number-like value that is really text", () => {
    // A phone number is the honest case for a leading "+": it is not an attack,
    // but the tab is stripped again on re-import so nothing is lost.
    expect(csvSafeCell("+1 555 0100")).toBe("\t+1 555 0100");
  });

  it("exposes the same detector the guard uses", () => {
    expect(FORMULA_LEAD_RE.test("=1")).toBe(true);
    expect(FORMULA_LEAD_RE.test("  -1")).toBe(true);
    expect(FORMULA_LEAD_RE.test("A1")).toBe(false);
  });
});

describe("csvLine / toCsv", () => {
  it("quotes only what has to be quoted", () => {
    expect(csvLine(["plain", "1234", "a@b.test"])).toBe("plain,1234,a@b.test");
  });

  it("quotes commas, quotes and newlines, doubling embedded quotes", () => {
    expect(csvLine(['a,b', 'say "hi"', "line1\nline2"])).toBe(
      '"a,b","say ""hi""","line1\nline2"',
    );
  });

  it("quotes a guarded cell so the tab cannot be trimmed away", () => {
    expect(csvLine(["=1+1"])).toBe('"\t=1+1"');
  });

  it("joins rows with CRLF and adds no trailing newline", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });
});

describe("parseCsv", () => {
  it("reads a plain file", () => {
    expect(parseCsv("a,b,c\r\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("strips the BOM Excel writes", () => {
    expect(parseCsv("﻿a,b\r\n1,2")[0]).toEqual(["a", "b"]);
  });

  it("handles quoted fields with commas, quotes and newlines", () => {
    expect(parseCsv('"Doe, Jane","say ""hi""","two\nlines"')).toEqual([
      ["Doe, Jane", 'say "hi"', "two\nlines"],
    ]);
  });

  it("keeps a quote that is not at the start of a field, like csv.reader", () => {
    expect(parseCsv('ab"cd,e')).toEqual([['ab"cd', "e"]]);
  });

  it("does not emit a phantom record for a trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toHaveLength(2);
  });

  it("keeps a trailing empty field", () => {
    expect(parseCsv("a,")).toEqual([["a", ""]]);
  });

  it("accepts bare LF and bare CR line endings", () => {
    expect(parseCsv("a,b\n1,2")).toHaveLength(2);
    expect(parseCsv("a,b\r1,2")).toHaveLength(2);
  });

  it("returns nothing for empty text", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("round-trips what toCsv writes", () => {
    const rows = [
      ["Net ID", "Employer", "Notes"],
      ["jsmith", 'Acme, "the" firm', "line1\nline2"],
      ["=evil", " -also evil", ""],
    ];
    const parsed = parseCsv(toCsv(rows));
    expect(parsed[0]).toEqual(rows[0]);
    expect(parsed[1]).toEqual(rows[1]);
    // The guarded cells come back tab-prefixed — which the importer strips.
    expect(parsed[2]).toEqual(["\t=evil", "\t -also evil", ""]);
    expect(parsed[2].map((c) => c.trim())).toEqual(["=evil", "-also evil", ""]);
  });
});
