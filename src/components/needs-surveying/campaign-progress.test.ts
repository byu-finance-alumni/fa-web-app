import { describe, expect, it } from "vitest";
import {
  formatRate,
  toProgressRow,
  toProgressRows,
  totalProgress,
} from "./campaign-progress";

type Item = Parameters<typeof toProgressRow>[0];

function item(over: Partial<Item> = {}): Item {
  return {
    survey_schedule_id: 1,
    graduation_year: 2018,
    start_date: "2026-08-05",
    status: "active",
    recipients: 0,
    replied: 0,
    awaiting_review: 0,
    non_responders: 0,
    ...over,
  } as Item;
}

describe("per-year row", () => {
  it("derives the rate from the people actually emailed", () => {
    const row = toProgressRow(item({ recipients: 26, replied: 13 }));
    expect(row.emailed).toBe(26);
    expect(row.replied).toBe(13);
    expect(row.responseRate).toBe(50);
  });

  it("counts everyone emailed and not yet replied as still silent", () => {
    expect(toProgressRow(item({ recipients: 26, replied: 4 })).silent).toBe(22);
  });

  it("reports no rate at all before anyone has been emailed", () => {
    // A campaign created but not yet sent has NO rate. Rendering 0% would read
    // as "we asked and nobody answered", which is a different and worse claim.
    const row = toProgressRow(item({ recipients: 0, replied: 0 }));
    expect(row.responseRate).toBeNull();
    expect(formatRate(row.responseRate)).toBe("—");
  });

  it("never shows a negative silent count", () => {
    // Only reachable if the two counts came from different populations, which
    // would be a backend bug — but it must not surface as a nonsense number.
    expect(toProgressRow(item({ recipients: 5, replied: 9 })).silent).toBe(0);
  });

  it("keeps needs-follow-up separate from merely silent", () => {
    // `non_responders` is the stronger claim: all three emails sent, no reply.
    // Mid-cadence it is legitimately 0 while plenty of people are still silent.
    const row = toProgressRow(
      item({ recipients: 30, replied: 2, non_responders: 0 }),
    );
    expect(row.silent).toBe(28);
    expect(row.needsFollowUp).toBe(0);
  });

  it("orders newest cohort first", () => {
    const rows = toProgressRows([
      item({ graduation_year: 2015 }),
      item({ graduation_year: 2020 }),
      item({ graduation_year: 2018 }),
    ]);
    expect(rows.map((r) => r.graduationYear)).toEqual([2020, 2018, 2015]);
  });
});

describe("totals", () => {
  it("recomputes the overall rate from the summed counts", () => {
    // NOT the average of 50% and 10%. A 4-person cohort must not weigh the same
    // as a 400-person one, or the headline is true of nobody.
    const rows = toProgressRows([
      item({ graduation_year: 2020, recipients: 4, replied: 2 }),
      item({ graduation_year: 2019, recipients: 400, replied: 40 }),
    ]);
    const totals = totalProgress(rows);
    expect(totals.emailed).toBe(404);
    expect(totals.replied).toBe(42);
    expect(totals.responseRate).toBe(10); // 42/404, not (50+10)/2
  });

  it("adds up every column", () => {
    const rows = toProgressRows([
      item({ graduation_year: 2020, recipients: 10, replied: 3, awaiting_review: 2, non_responders: 1 }),
      item({ graduation_year: 2019, recipients: 20, replied: 5, awaiting_review: 1, non_responders: 4 }),
    ]);
    const totals = totalProgress(rows);
    expect(totals.silent).toBe(22);
    expect(totals.toReview).toBe(3);
    expect(totals.needsFollowUp).toBe(5);
  });

  it("has no rate when nothing has been sent anywhere", () => {
    expect(totalProgress(toProgressRows([item()])).responseRate).toBeNull();
  });

  it("is empty-safe", () => {
    const totals = totalProgress([]);
    expect(totals.emailed).toBe(0);
    expect(totals.responseRate).toBeNull();
  });
});
