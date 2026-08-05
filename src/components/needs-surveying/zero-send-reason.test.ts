/**
 * Why a survey send emailed nobody (#392).
 *
 * Jake's report: the console told him a cohort had no personal email on file
 * when it plainly did. The old message hard-coded that explanation onto EVERY
 * zero-send regardless of cause — his alumni had simply all replied inside the
 * 365-day re-survey window. A confidently wrong reason is worse than none: it
 * sends staff chasing contact data that is already correct.
 *
 * These pin the reason to the bucket that actually stopped the send.
 */

import { describe, expect, it } from "vitest";

import { zeroSendReason } from "./SurveyCampaignConsole";

type Breakdown = {
  graduation_year: number;
  cohort_total: number;
  suppressed: number;
  already_responded: number;
  unreachable: number;
  eligible: number;
  duplicate_emails: number;
  recipients: number;
  work_email_fallback: number;
};

function breakdown(over: Partial<Breakdown> = {}): Breakdown {
  return {
    graduation_year: 1900,
    cohort_total: 0,
    suppressed: 0,
    already_responded: 0,
    unreachable: 0,
    eligible: 0,
    duplicate_emails: 0,
    recipients: 0,
    work_email_fallback: 0,
    ...over,
  };
}

// Only the fields the reason logic reads; the rest of SurveySendResult is
// irrelevant here and stubbing it whole would obscure what drives the message.
function result(over: Record<string, unknown> = {}) {
  return {
    graduation_year: 1900,
    total_recipients: 0,
    prepared: 0,
    sent: 0,
    remaining: 0,
    dry_run: false,
    retry_after_seconds: null,
    sample: [],
    // Present since api.gen.ts was regenerated against the deployed backend —
    // the send result now always carries these, so the stub has to as well.
    stage_complete: false,
    breakdown: null,
    ...over,
  } as Parameters<typeof zeroSendReason>[0];
}

describe("zeroSendReason", () => {
  it("blames the 365-day window when everyone has already replied", () => {
    // THE reported bug: this used to read "they need a personal email on file".
    const msg = zeroSendReason(
      result({ breakdown: breakdown({ cohort_total: 3, already_responded: 3 }) }),
    );
    expect(msg).toContain("already replied");
    expect(msg).not.toContain("email address");
  });

  it("blames missing addresses only when that is actually the cause", () => {
    const msg = zeroSendReason(
      result({ breakdown: breakdown({ cohort_total: 4, unreachable: 4 }) }),
    );
    expect(msg).toContain("no usable email address");
  });

  it("reports suppression separately from unreachability", () => {
    // The two must never be merged into one "not emailed" figure: one is a
    // decision to honour, the other a gap to close.
    const msg = zeroSendReason(
      result({
        breakdown: breakdown({
          cohort_total: 5,
          suppressed: 2,
          unreachable: 3,
        }),
      }),
    );
    expect(msg).toContain("2 are marked Deceased or Do Not Contact");
    expect(msg).toContain("3 have no usable email address");
  });

  it("lists every contributing cause, not just the first", () => {
    const msg = zeroSendReason(
      result({
        breakdown: breakdown({
          cohort_total: 6,
          already_responded: 1,
          unreachable: 2,
          suppressed: 3,
        }),
      }),
    );
    expect(msg).toContain("already replied");
    expect(msg).toContain("no usable email address");
    expect(msg).toContain("Deceased or Do Not Contact");
  });

  it("says the campaign is finished when every stage has been delivered", () => {
    // `sent=0` here is success, not a fault — it must not read as an error about
    // missing data.
    const msg = zeroSendReason(
      result({
        stage_complete: true,
        breakdown: breakdown({ cohort_total: 3, recipients: 3 }),
      }),
    );
    expect(msg).toContain("already received every email");
  });

  it("points at the send cap when recipients exist but none went out", () => {
    const msg = zeroSendReason(
      result({ breakdown: breakdown({ cohort_total: 9, recipients: 9 }) }),
    );
    expect(msg).toContain("send cap");
  });

  it("says so plainly when the year has no alumni at all", () => {
    const msg = zeroSendReason(result({ breakdown: breakdown() }));
    expect(msg).toContain("no alumni in this graduation year");
  });

  it("degrades safely against an API that predates the breakdown", () => {
    // The frontend may deploy before the backend; it must not invent a reason.
    const msg = zeroSendReason(result({ total_recipients: 7 }));
    expect(msg).toContain("7 recipients");
    expect(msg).not.toContain("personal email");
  });
});
