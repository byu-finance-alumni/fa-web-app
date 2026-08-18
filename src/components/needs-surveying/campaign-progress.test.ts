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
    applied: 0,
    rejected: 0,
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

  it("carries the applied and rejected outcomes through untouched", () => {
    // These are staff decisions, not arithmetic: whatever the backend counted
    // per graduation year is what the column shows.
    const row = toProgressRow(
      item({ recipients: 40, replied: 12, awaiting_review: 3, applied: 8, rejected: 2 }),
    );
    expect(row.applied).toBe(8);
    expect(row.rejected).toBe(2);
  });

  it("still counts a rejected alumnus as owing a reply", () => {
    // The one that will look like a bug to whoever reads the table next.
    // Rejecting a submission DISCARDS it, so the backend does not count it as a
    // reply — the same person is legitimately in `rejected` AND in `silent`.
    // If this ever starts subtracting rejections from the silent count, the
    // follow-up list and this table stop agreeing about who still owes us
    // something, which is the exact drift #497 warned about.
    const row = toProgressRow(
      item({ recipients: 10, replied: 0, rejected: 3 }),
    );
    expect(row.rejected).toBe(3);
    expect(row.silent).toBe(10);
  });

  it("does not treat the status columns as a partition of the repliers", () => {
    // An alum who submitted twice — one applied, one rejected — is in both
    // columns, so to-review + applied + rejected can legitimately EXCEED
    // `replied`. Nothing may derive a total from summing across them.
    const row = toProgressRow(
      item({ recipients: 5, replied: 1, awaiting_review: 1, applied: 1, rejected: 1 }),
    );
    expect(row.toReview + row.applied + row.rejected).toBeGreaterThan(
      row.replied,
    );
    // ...and the rate is still replied/emailed, untouched by the outcomes.
    expect(row.responseRate).toBe(20);
  });

  it("defaults missing outcome counts to zero", () => {
    // Older payloads (and the schema defaults) can omit them; a blank cell or
    // NaN in a numeric column is worse than a 0.
    const row = toProgressRow({
      ...item(),
      applied: undefined,
      rejected: undefined,
    } as unknown as Item);
    expect(row.applied).toBe(0);
    expect(row.rejected).toBe(0);
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
      item({ graduation_year: 2020, recipients: 10, replied: 3, awaiting_review: 2, applied: 1, rejected: 2, non_responders: 1 }),
      item({ graduation_year: 2019, recipients: 20, replied: 5, awaiting_review: 1, applied: 4, rejected: 3, non_responders: 4 }),
    ]);
    const totals = totalProgress(rows);
    expect(totals.silent).toBe(22);
    expect(totals.toReview).toBe(3);
    expect(totals.applied).toBe(5);
    expect(totals.rejected).toBe(5);
    expect(totals.needsFollowUp).toBe(5);
  });

  it("totals applied and rejected DOWN their own column only", () => {
    // Each column is summed across years and nothing else. Deliberately the
    // same arithmetic as every other count — no cross-column derivation, since
    // the outcomes overlap and any "total submissions" built from them would
    // double-count anyone who submitted more than once.
    const rows = toProgressRows([
      item({ graduation_year: 2021, recipients: 100, replied: 40, applied: 30, rejected: 12 }),
      item({ graduation_year: 2020, recipients: 50, replied: 10, applied: 6, rejected: 5 }),
    ]);
    const totals = totalProgress(rows);
    expect(totals.applied).toBe(36);
    expect(totals.rejected).toBe(17);
    // The headline rate is untouched by outcomes: 50/150, not (40-12+10-5)/150.
    expect(totals.responseRate).toBe(33);
  });

  it("is empty-safe for the outcome columns too", () => {
    const totals = totalProgress([]);
    expect(totals.applied).toBe(0);
    expect(totals.rejected).toBe(0);
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
