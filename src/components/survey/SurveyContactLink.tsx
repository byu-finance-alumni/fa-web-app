"use client";

import {
  SURVEY_CONTACT_PROMPT,
  surveyContactFrom,
  surveyContactLinkText,
  surveyContactMailtoHref,
} from "@/lib/surveyContact";

/**
 * "Email us directly" at the foot of the PUBLIC survey (#774).
 *
 * A text-only link — no icon, no button chrome — sitting as the last thing in
 * the reading column on every survey screen, just above the shell's Marriott
 * sign-off. It opens the visitor's mail client on a new message to the
 * configured contact with the subject already filled in.
 *
 * ⚠️ RENDERS NOTHING when no contact is configured. That is the designed
 * behaviour, not a failure mode — see `surveyContactFrom`. An unset or
 * malformed address must never become a `mailto:` that opens a blank message,
 * because a respondent who believes they have written to a human stops looking
 * for another way to reach one.
 *
 * ⚠️ PUBLIC PATH. `/survey/*` skips authentication entirely (`isNoAuthPath`),
 * so this file and everything it imports must stay clear of sessions, users and
 * the Supabase client. `@/lib/surveyContact` imports nothing at all, and
 * `ways-to-help.test.ts` walks both survey pages' imports transitively to keep
 * it that way.
 *
 * The contact is a PROP rather than something this component fetches, and that
 * is what keeps the above true. `GET /support-contacts` needs a signed-in
 * caller and has no unauthenticated sibling on purpose, so the real screens
 * take the contact from `GET /survey/respond/{token}` — the public, token-gated
 * endpoint they already read — and pass it down. The staff sample survey has no
 * token, so it resolves the same row from the authenticated list instead
 * (`surveySupportContact`). Both land here as the same two fields.
 *
 * ⚠️ NO WRAPPER, NO RULE, NO BAND. This is a single paragraph inside the shell's
 * 800px column. Do not give it a full-width container, a top border or a
 * background: a pale strip in the survey layout has come back five times, and
 * the review screen's `TrustNote` already carries the only rule that belongs
 * near the foot of the page.
 */
export function SurveyContactLink({
  contact: raw,
}: {
  /** Straight from `support_contact` on the survey payload, or the row the
   *  sample survey resolved. `null`/absent renders nothing. */
  contact?: { name?: string | null; email?: string | null } | null;
}) {
  const contact = surveyContactFrom(raw ?? {});
  if (!contact) return null;

  return (
    <p className="mt-8 text-center text-sm leading-relaxed text-gray-500">
      {SURVEY_CONTACT_PROMPT}{" "}
      <a
        href={surveyContactMailtoHref(contact)}
        className="font-medium text-brand-blue-600 hover:text-brand-blue-500 hover:underline"
      >
        {surveyContactLinkText(contact)}
      </a>
    </p>
  );
}
