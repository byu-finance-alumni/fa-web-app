import { describe, expect, it } from "vitest";

import {
  disabledReason,
  emailSourceNote,
  formatSurveyDate,
  lastRepliedNote,
  lastSentWarning,
  sentToast,
  type SurveyOneOffPreview,
} from "./surveyOneOff";

function preview(over: Partial<SurveyOneOffPreview> = {}): SurveyOneOffPreview {
  return {
    alumni_id: 1,
    name: "Ann Lovelace",
    graduation_year: 2019,
    email: "ann@byu.edu",
    email_source: "personal",
    can_send: true,
    reason_code: null,
    reason: null,
    last_sent_at: null,
    last_replied_at: null,
    ...over,
  };
}

describe("formatSurveyDate", () => {
  it("formats an ISO timestamp as a short UTC date", () => {
    expect(formatSurveyDate("2026-11-04T23:30:00Z")).toBe("Nov 4, 2026");
  });
  it("returns null for missing or unreadable dates", () => {
    expect(formatSurveyDate(null)).toBeNull();
    expect(formatSurveyDate(undefined)).toBeNull();
    expect(formatSurveyDate("not a date")).toBeNull();
  });
});

describe("disabledReason", () => {
  it("is null when the survey can be sent", () => {
    expect(disabledReason(preview())).toBeNull();
  });
  it("uses the backend's reason when it can't be sent", () => {
    expect(
      disabledReason(
        preview({
          can_send: false,
          reason_code: "suppressed",
          reason: "Marked deceased or Do Not Contact.",
        }),
      ),
    ).toBe("Marked deceased or Do Not Contact.");
  });
  it("still explains itself when the backend gave no wording", () => {
    expect(
      disabledReason(preview({ can_send: false, reason_code: "x", reason: null })),
    ).toBe("This person can't be sent the survey.");
  });
});

describe("lastSentWarning", () => {
  it("is null for someone never sent a survey", () => {
    expect(lastSentWarning(preview())).toBeNull();
  });
  it("names the date of the last send", () => {
    expect(
      lastSentWarning(preview({ last_sent_at: "2026-10-22T18:00:00Z" })),
    ).toBe("Last sent on Oct 22, 2026.");
  });
});

describe("lastRepliedNote", () => {
  it("names the reply date, or nothing", () => {
    expect(lastRepliedNote(preview())).toBeNull();
    expect(lastRepliedNote(preview({ last_replied_at: "2026-10-02T12:00:00Z" }))).toBe(
      "Replied on Oct 2, 2026.",
    );
  });
});

describe("emailSourceNote", () => {
  it("only speaks up for the work-email fallback", () => {
    expect(emailSourceNote("personal")).toBeNull();
    expect(emailSourceNote(null)).toBeNull();
    expect(emailSourceNote("work")).toBe("Work email. No personal email on file.");
  });
});

describe("sentToast", () => {
  it("says who and where", () => {
    expect(sentToast("Ann Lovelace", "ann@byu.edu")).toBe(
      "Survey sent to Ann Lovelace at ann@byu.edu.",
    );
  });
});
