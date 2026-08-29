/**
 * The "email us directly" address shown at the foot of the PUBLIC survey (#774).
 *
 * Tanya's ask (2026-08-28): "a 'click to email Tanya Harmon directly' button at
 * the bottom of the survey and it will automatically say 'Finance Alumni Survey
 * response' or something like that in the subject line."
 *
 * ⚠️ WHY THIS ISN'T READ FROM `support_contacts`.
 *
 * The obvious home for the address is the engineer-managed `support_contacts`
 * table (`/engineer/support-contacts`). Its SHAPE fits perfectly — `role_label`,
 * `name`, `email`, `sort_order`, exactly the "pick the row by label" pattern
 * `survey-reset-contact.ts` already uses for the engineer.
 *
 * It is NOT REACHABLE from here. `GET /support-contacts` is declared
 * `RequireViewAccess` in the backend (`app/api/routes/support.py`), and that
 * file says so on purpose: "there is deliberately NO unauthenticated endpoint,
 * so these names/emails are never exposed on the public login page." The only
 * client for it, `src/lib/api.ts`, attaches the signed-in user's Supabase token
 * — an import that must never reach `/survey/*`, which skips authentication
 * entirely. A survey respondent is a stranger holding a signed token and has no
 * session to authenticate with.
 *
 * So the contact is passed IN as a prop rather than fetched here. It reaches
 * the real screens on `support_contact` from the public, token-gated
 * `GET /survey/respond/{token}` they already read (fa-web-api#506), and reaches
 * the staff sample survey from the authenticated support-contacts list, which
 * that dialog can see. Both resolve the same row -- the frontend's
 * `surveySupportContact` mirrors the backend's `SURVEY_CONTACT_LABEL` rule.
 *
 * ⚠️ The address is EDITABLE IN THE APP: engineer console -> Support contacts,
 * on the row whose role label contains "survey". No env var, no redeploy. An
 * earlier version of this used `NEXT_PUBLIC_SURVEY_CONTACT_*`; those vars are
 * gone and must not come back, because a second source for the address is how
 * the survey ends up pointing somewhere nobody reads.
 */

/** A contact we are willing to put behind a `mailto:`. */
export type SurveyContact = {
  /** Display name for the link text. Falls back to the address when unset. */
  name: string;
  /** Validated address — see `isPlausibleEmail`. */
  email: string;
};

/**
 * The pre-filled subject, from Tanya's wording. A respondent's reply lands in
 * her inbox already labelled, so it can be filed against the campaign rather
 * than read as an unexplained email from a stranger.
 */
export const SURVEY_CONTACT_SUBJECT = "Finance Alumni Survey response";

/**
 * Deliberately strict, and stricter than the RFC.
 *
 * This value is interpolated into an `href` that a browser hands to the user's
 * mail client, so the characters that matter are the ones that would change
 * what that href MEANS: `?` and `&` would append extra `mailto:` parameters
 * (a second subject, a cc, a body), `,` and `;` would add recipients, and
 * whitespace or a control character would let a newline through. None of them
 * survive this pattern, so the address can be written into the href as-is
 * rather than percent-encoded into something mail clients render badly.
 *
 * Being narrower than the RFC is the right trade here: the cost of rejecting an
 * exotic-but-legal address is that the control does not appear, which is the
 * same honest nothing we render when none is configured — not a broken link.
 */
const PLAUSIBLE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** Whether `value` is an address we will put behind a `mailto:`. */
export function isPlausibleEmail(value: string): boolean {
  return value.length <= 254 && PLAUSIBLE_EMAIL.test(value);
}

/**
 * The configured contact, or `null` when there isn't a usable one.
 *
 * ⚠️ `null` IS THE POINT. A missing or malformed address renders NOTHING (see
 * `SurveyContactLink`) rather than a `mailto:` that opens a blank message or
 * addresses nobody. A dead button is worse than no button: the respondent
 * believes they have written to a human and stops looking for another way to
 * reach one, and we never learn the message was lost.
 *
 * Takes its values as an argument rather than reading `process.env` itself, so
 * this stays a pure function the suite can drive — and so the single place that
 * names the environment variables is the component that renders them. Next only
 * inlines `NEXT_PUBLIC_*` at literal references, so they cannot be read
 * dynamically here anyway.
 */
export function surveyContactFrom(raw: {
  name?: string | null;
  email?: string | null;
}): SurveyContact | null {
  const email = (raw.email ?? "").trim();
  if (!isPlausibleEmail(email)) return null;
  // The name is presentation only: with none configured the address itself is
  // the label, which still reads as a real destination.
  const name = (raw.name ?? "").trim();
  return { name: name || email, email };
}

/**
 * The `mailto:` href, with the subject already filled in.
 *
 * Only the subject is encoded — the address is left literal because
 * `isPlausibleEmail` has already excluded every character that would need
 * escaping, and `encodeURIComponent` would otherwise turn the `@` into `%40`,
 * which some mail clients surface to the user verbatim.
 */
export function surveyContactMailtoHref(contact: SurveyContact): string {
  return `mailto:${contact.email}?subject=${encodeURIComponent(SURVEY_CONTACT_SUBJECT)}`;
}

/**
 * The sentence around the link. Kept here beside the subject so the two read as
 * one thought, and so the copy can be checked without a DOM.
 *
 * ⚠️ THIS LINK IS ALSO THE ONLY WAY AN ALUM CAN OPT OUT. Amy, 2026-08-29:
 * alumni must NOT get a button that switches these emails off by itself. An
 * opt-out is a message to Tanya, and staff then set Do Not Contact from inside
 * the app. So the sentence has to name opting out explicitly; if it only offers
 * "a question", nobody who wants out will find their way here.
 *
 * ⚠️ Do not "restore" a missing unsubscribe control. There is no unsubscribe
 * button anywhere under `/survey`, and its absence is the requirement, not an
 * oversight.
 */
export const SURVEY_CONTACT_PROMPT =
  "If you would rather not receive these updates, or want to reach the BYU Finance Career Director about anything else,";

/**
 * The link's own text, e.g. "email Tanya Harmon".
 *
 * Amy's wording said "please click here". Deliberately not that: "click here"
 * tells a screen-reader user nothing about where the link goes, and it is the
 * one link on the page. Naming the destination keeps her sentence intact and
 * reads the same aloud as it does on screen.
 */
export function surveyContactLinkText(contact: SurveyContact): string {
  return `email ${contact.name}`;
}
