/**
 * The "Yes, everything is correct" path, as pure logic (#755).
 *
 * Confirming used to be `setStatus("confirmed")` and nothing else — a client
 * state flip that recorded NOTHING and dead-ended on a panel whose only control
 * was "I need to make changes". The alumni quickest to reply were therefore the
 * only ones never asked to mentor, speak, or share a job opening, because both
 * of those asks live inside the EDIT flow.
 *
 * Confirming now POSTs, and the alum lands on the ways-to-help page. Everything
 * in this file is the part of that flow with no React in it, so the decisions
 * that matter — what the confirmation body is, which keys the ways-to-help page
 * is allowed to submit, what an alum is told when the POST fails — are testable
 * in the Node-only vitest suite rather than only observable by clicking.
 *
 * ⚠️ NOTHING auth-dependent may be imported here, directly or transitively.
 * `/survey/*` skips authentication entirely; a public page that reaches for
 * session state is a runtime error for the one visitor who has none. This file
 * imports nothing at all, and it must stay that way.
 */

/**
 * The body of a bare confirmation: `POST /survey/respond/{token}` with the
 * `confirmed_only` flag and NO content.
 *
 * ⚠️ `fields` MUST stay empty and `has_photo` MUST stay false. The backend
 * ignores `confirmed_only` whenever the body carries fields or a photo —
 * content always wins — so a confirmation sent alongside anything else is
 * silently recorded as an ordinary staged response instead. That is why the
 * ways-to-help page's involvement answers go as a SECOND, ordinary POST rather
 * than being folded into this one.
 */
export function confirmOnlyBody(): {
  fields: Record<string, string>;
  has_photo: boolean;
  confirmed_only: boolean;
} {
  return { fields: {}, has_photo: false, confirmed_only: true };
}

/**
 * A status that means the token itself is finished — expired, mistyped, or the
 * alum archived. There is nothing to retry, so the page shows `InvalidPanel`
 * rather than an error the alum would press again forever.
 */
export function isDeadTokenStatus(status: number | null): boolean {
  return status === 404 || status === 410;
}

/**
 * What an alum is told when the confirmation POST does not land.
 *
 * The confirmation is the whole point of the press, so a failure is never
 * swallowed and never dressed up as success: the alum stays on the review
 * screen with their information still in front of them and this message under
 * the buttons. Every message ends by pointing at "I need to make changes",
 * which does not depend on the failed request — so even a hard failure leaves
 * a way to reply rather than a dead screen.
 */
export function confirmErrorMessage(status: number | null): string {
  switch (status) {
    case 404:
    case 410:
      return "This survey link has expired, so we couldn't record your confirmation. Please ask the BYU Finance team for a fresh link.";
    case 429:
      return "We've had too many requests from this link in a short time. Please wait a minute and press \u201cYes, everything is correct\u201d again, or press \u201cI need to make changes\u201d to update your details instead.";
    default:
      return "We couldn't record your confirmation just now \u2014 this is usually a connection problem, and nothing has been saved. Please press \u201cYes, everything is correct\u201d again, or press \u201cI need to make changes\u201d to update your details instead.";
  }
}

/** Where a confirmed alum lands. */
export function waysToHelpHref(token: string): string {
  return `/survey/${encodeURIComponent(token)}/help`;
}

/**
 * Back to the review screen — the "I need to make changes" escape hatch on the
 * ways-to-help page.
 *
 * It lands on REVIEW, not straight in the edit form, deliberately. `?step=edit`
 * is demo-only by design (see the survey page): a real alum must meet the
 * review panel first, because that is where they are told what we hold and that
 * a human checks the answer. The button they came for is the second thing on
 * that screen, so nobody who confirmed by mistake is trapped.
 */
export function surveyReviewHref(token: string): string {
  return `/survey/${encodeURIComponent(token)}`;
}

/**
 * The subset of an edit map the ways-to-help page is allowed to send.
 *
 * Two jobs, both load-bearing:
 *
 *  1. It is the guarantee that this page cannot submit a PROFILE field. The
 *     page renders only the involvement questions, so `edits` should never hold
 *     anything else — but "should never" is not a guarantee, and a payload
 *     carrying a name or an employer from a page that never showed either would
 *     stage a change the alum did not make.
 *  2. It drops blanks, so an alum who opens the page and answers nothing sends
 *     nothing. That is what lets Submit work with no answers at all instead of
 *     staging an empty response row.
 */
export function answeredFields(
  edits: Record<string, string>,
  allowedKeys: readonly string[],
): Record<string, string> {
  const allowed = new Set(allowedKeys);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(edits)) {
    if (!allowed.has(key)) continue;
    if (value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

/**
 * The thank-you copy after a ways-to-help submission, which has to be honest
 * about three different outcomes.
 *
 * An alum can legitimately press Submit having answered nothing — their
 * confirmation is already recorded, so the page must not gate the button on
 * having done more. Telling that person "your updates are in" would be a
 * fiction, so the empty case says what actually happened instead.
 */
export function waysToHelpThanksBody({
  answerCount,
  linkCount,
}: {
  answerCount: number;
  linkCount: number;
}): string {
  const parts: string[] = [];
  if (answerCount > 0) {
    parts.push(
      "We've recorded what you're open to helping with — our team reviews every response before anything is added to your record, and someone will be in touch before you're asked to do anything.",
    );
  }
  if (linkCount > 0) {
    parts.push(
      linkCount === 1
        ? "We've also received the opportunity you shared — our team checks each one before passing it on to students."
        : `We've also received the ${linkCount} opportunities you shared — our team checks each one before passing them on to students.`,
    );
  }
  if (parts.length === 0) {
    parts.push(
      "Your confirmation is recorded, so there's nothing else you need to do.",
    );
  }
  parts.push("You can safely close this page.");
  return parts.join(" ");
}
