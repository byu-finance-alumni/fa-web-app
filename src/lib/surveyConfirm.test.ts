import { describe, expect, it } from "vitest";

import {
  answeredFields,
  confirmErrorMessage,
  confirmOnlyBody,
  isDeadTokenStatus,
  surveyReviewHref,
  waysToHelpHref,
  waysToHelpThanksBody,
} from "./surveyConfirm";

/**
 * The confirm → ways-to-help flow's rules (#755), tested where they live: as
 * pure functions. The suite runs in Node with no DOM, so what is covered here
 * is every decision that does not need a browser to be wrong — the shape of the
 * confirmation body, what the page is allowed to submit afterwards, and what an
 * alum is told when the POST does not land.
 */

describe("the confirmation body", () => {
  it("sends confirmed_only with NO content", () => {
    // ⚠️ The backend IGNORES `confirmed_only` whenever the body carries fields
    // or a photo — content always wins — so a confirmation bundled with
    // anything else is silently filed as an ordinary staged response and the
    // `confirmed` row never exists. Empty is not an oversight here, it is the
    // contract.
    expect(confirmOnlyBody()).toEqual({
      fields: {},
      has_photo: false,
      confirmed_only: true,
    });
  });

  it("builds a fresh object each time", () => {
    // A shared literal would let one caller's mutation reach the next
    // submission's payload.
    const a = confirmOnlyBody();
    a.fields["profile.first_name"] = "Nope";
    expect(confirmOnlyBody().fields).toEqual({});
  });
});

describe("when the confirmation POST fails", () => {
  it("treats an expired or archived token as unretryable", () => {
    expect(isDeadTokenStatus(404)).toBe(true);
    expect(isDeadTokenStatus(410)).toBe(true);
    expect(isDeadTokenStatus(429)).toBe(false);
    expect(isDeadTokenStatus(500)).toBe(false);
    expect(isDeadTokenStatus(null)).toBe(false);
  });

  it("never claims the confirmation was recorded", () => {
    for (const status of [null, 429, 500, 502, 404]) {
      const message = confirmErrorMessage(status);
      expect(message).not.toMatch(/thank|received|recorded your|all set/i);
      expect(message).toMatch(/couldn't|too many/i);
    }
  });

  it("always points at a way forward that does not need the failed request", () => {
    // The whole failure design: the alum stays on the review screen with their
    // information in front of them, so "I need to make changes" — which never
    // depended on this POST — is still right there. A message that only says
    // "something went wrong" would be the dead screen this issue exists to
    // remove.
    for (const status of [null, 429, 500]) {
      expect(confirmErrorMessage(status)).toContain("I need to make changes");
    }
  });

  it("tells a rate-limited alum to wait rather than to hammer the button", () => {
    expect(confirmErrorMessage(429)).toMatch(/wait a minute/i);
  });

  it("says a dead link needs a fresh one, not another press", () => {
    const message = confirmErrorMessage(404);
    expect(message).toMatch(/expired/i);
    expect(message).toMatch(/fresh link/i);
  });
});

describe("where confirming leads", () => {
  it("lands on the ways-to-help page for that token", () => {
    expect(waysToHelpHref("abc123")).toBe("/survey/abc123/help");
  });

  it("sends 'I need to make changes' back to REVIEW, not into the form", () => {
    // `?step=edit` is demo-only by design on the survey page: a real alum must
    // meet the review panel first. Appending it here would quietly undo that.
    expect(surveyReviewHref("abc123")).toBe("/survey/abc123");
    expect(surveyReviewHref("abc123")).not.toContain("step=edit");
  });

  it("escapes the token in both", () => {
    expect(waysToHelpHref("a/b?c")).toBe("/survey/a%2Fb%3Fc/help");
    expect(surveyReviewHref("a/b?c")).toBe("/survey/a%2Fb%3Fc");
  });
});

describe("what the ways-to-help page may submit", () => {
  const allowed = ["program.mentor_willing", "program.guest_speaker_willing"];

  it("keeps the involvement answers the alum gave", () => {
    expect(
      answeredFields(
        { "program.mentor_willing": "Yes", "program.guest_speaker_willing": "No" },
        allowed,
      ),
    ).toEqual({
      "program.mentor_willing": "Yes",
      "program.guest_speaker_willing": "No",
    });
  });

  it("cannot submit a profile field the page never showed", () => {
    // The page renders involvement questions and nothing else, so a name or an
    // employer in the payload could only come from a bug — and would stage a
    // change the alum never made, on a screen that told them their details were
    // already right.
    expect(
      answeredFields(
        {
          "profile.first_name": "Wrong",
          "employment.current_employer": "Wrong",
          "program.mentor_willing": "Yes",
        },
        allowed,
      ),
    ).toEqual({ "program.mentor_willing": "Yes" });
  });

  it("drops blanks, so an alum who answers nothing sends nothing", () => {
    expect(
      answeredFields(
        { "program.mentor_willing": "", "program.guest_speaker_willing": "   " },
        allowed,
      ),
    ).toEqual({});
  });

  it("submitting an untouched page is a no-op, not an empty response row", () => {
    expect(answeredFields({}, allowed)).toEqual({});
  });
});

describe("the thank-you copy", () => {
  it("does not claim updates are in when nothing was sent", () => {
    // An alum can legitimately press Submit having added nothing: their
    // confirmation was already recorded before they reached the page, so the
    // button is not gated on doing more. Saying "your updates are in" to that
    // person would be a fiction.
    const body = waysToHelpThanksBody({ answerCount: 0, linkCount: 0 });
    expect(body).toMatch(/confirmation is recorded/i);
    expect(body).not.toMatch(/updates are in|we've recorded what you're open to/i);
    expect(body).toContain("You can safely close this page.");
  });

  it("mentions involvement answers when there were some", () => {
    const body = waysToHelpThanksBody({ answerCount: 3, linkCount: 0 });
    expect(body).toMatch(/what you're open to/i);
    expect(body).not.toMatch(/opportunit/i);
  });

  it("counts shared opportunities, singular and plural", () => {
    expect(waysToHelpThanksBody({ answerCount: 0, linkCount: 1 })).toContain(
      "the opportunity you shared",
    );
    expect(waysToHelpThanksBody({ answerCount: 0, linkCount: 2 })).toContain(
      "the 2 opportunities you shared",
    );
  });

  it("covers both when the alum did both", () => {
    const body = waysToHelpThanksBody({ answerCount: 2, linkCount: 1 });
    expect(body).toMatch(/what you're open to/i);
    expect(body).toMatch(/opportunity you shared/i);
    expect(body).not.toMatch(/nothing else you need to do/i);
  });
});
