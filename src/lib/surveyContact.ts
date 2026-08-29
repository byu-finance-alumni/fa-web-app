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
 * So the address is configured instead. `NEXT_PUBLIC_SURVEY_CONTACT_EMAIL` /
 * `NEXT_PUBLIC_SURVEY_CONTACT_NAME` are set per Vercel project, which keeps the
 * address out of the source and out of a code change when Tanya's mailbox moves
 * or someone else takes the role — but a change does need a redeploy to take
 * effect, because `NEXT_PUBLIC_*` values are inlined at build time.
 *
 * ⚠️ THE PROPER FIX IS ONE FIELD ON THE BACKEND, and it belongs in fa-web-api:
 * add an optional `support_contact: {name, email} | null` to `SurveyRespondInfo`
 * (`app/schemas/survey.py`), resolved from `support_contacts` by `role_label`
 * the way `engineerSupportContact` does it. It then arrives on the SAME public,
 * token-gated `GET /survey/respond/{token}` the pages already read, the address
 * becomes editable in the app with no deploy, and nothing else here changes:
 * feed the payload's value into `surveyContactFrom` instead of the environment
 * (`SurveyContactLink` is the only caller) and every function below still applies.
 *
 * Nothing in this module imports anything. Keep it that way — it is on the
 * public path.
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
 */
export const SURVEY_CONTACT_PROMPT =
  "Have a question, or something you'd rather tell us directly?";

/** The link's own text — "Email Tanya Harmon", from configuration. */
export function surveyContactLinkText(contact: SurveyContact): string {
  return `Email ${contact.name}`;
}
