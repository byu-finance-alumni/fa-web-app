/**
 * The "Bounced" list (#858): staff see whose survey email hard-bounced so they
 * can fix the address. These pin what each row says.
 */
import { describe, expect, it } from "vitest";

import {
  BOUNCED_PAGE_SIZE,
  bouncedDetail,
  bouncedFixedNote,
  bouncedHeadline,
  bouncedRequestPath,
  bouncedTruncatedNote,
  type SurveyBouncedAlum,
} from "./bounced";

const row = (over: Partial<SurveyBouncedAlum> = {}): SurveyBouncedAlum => ({
  alumni_id: 7,
  name: "Ada Test",
  bounced_address: "ada@example.org",
  bounce_subtype: "General",
  bounced_at: "2026-10-01T12:00:00Z",
  address_still_on_file: true,
  ...over,
});

describe("bouncedRequestPath", () => {
  it("asks for that year's bounced list", () => {
    expect(bouncedRequestPath(2020)).toBe(
      `/survey/campaigns/2020/bounced?limit=${BOUNCED_PAGE_SIZE}`,
    );
  });

  it("stays within the endpoint's ceiling of 1000", () => {
    expect(BOUNCED_PAGE_SIZE).toBeGreaterThan(0);
    expect(BOUNCED_PAGE_SIZE).toBeLessThanOrEqual(1000);
  });
});

describe("bouncedTruncatedNote", () => {
  const page = (shown: number, total: number) => ({
    graduation_year: 2020,
    total,
    limit: shown,
    items: Array.from({ length: shown }, (_, i) => row({ alumni_id: i })),
  });

  it("says nothing when every name is shown", () => {
    expect(bouncedTruncatedNote(page(3, 3))).toBe("");
  });

  it("says how many are shown when the list is capped", () => {
    expect(bouncedTruncatedNote(page(2, 7))).toBe("Showing the first 2 of 7.");
  });
});

describe("bouncedHeadline", () => {
  it("pluralises", () => {
    expect(bouncedHeadline(1)).toBe("1 alumnus whose email bounced");
    expect(bouncedHeadline(3)).toBe("3 alumni whose email bounced");
  });
});

describe("bouncedDetail", () => {
  it("leads with the address, then the reason and the date", () => {
    const text = bouncedDetail(row());
    expect(text.startsWith("ada@example.org")).toBe(true);
    expect(text).toContain("General");
    expect(text).toContain("Bounced Oct 1, 2026");
  });

  it("says so when the address is unknown rather than leaving it blank", () => {
    expect(bouncedDetail(row({ bounced_address: null }))).toContain(
      "Address not recorded",
    );
  });

  it("omits a missing reason", () => {
    expect(bouncedDetail(row({ bounce_subtype: null }))).not.toContain("null");
  });
});

describe("bouncedFixedNote", () => {
  it("flags only an address that has since been changed", () => {
    expect(bouncedFixedNote(row({ address_still_on_file: false }))).toBe(
      "Address since changed",
    );
    expect(bouncedFixedNote(row({ address_still_on_file: true }))).toBe("");
    expect(bouncedFixedNote(row({ address_still_on_file: null }))).toBe("");
  });
});
