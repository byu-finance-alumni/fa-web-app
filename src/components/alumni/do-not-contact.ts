/**
 * "Do not contact" — the record control's logic and wording (#772).
 *
 * Tanya, 2026-08-28: *"There needs to be a button on an alumni record that is
 * 'Do not contact'."* The BEHAVIOUR she is asking for already exists and is not
 * rebuilt here: `Do Not Contact` is one of the canonical status labels
 * (`STATUS_OPTIONS`, mirroring `STATUS_LABELS` in fa-web-api), and the survey
 * send already excludes everyone carrying it — `_suppressed_from_send()` in
 * `app/services/survey_email.py` ORs the deceased flag with
 * `SUPPRESSED_CONTACT_STATUS_LABELS`, and the SAME predicate un-negated is what
 * counts the suppressed, so the number the console reports is by construction
 * the number the send skipped. The held-out worklists scope themselves with the
 * negation of it, which is why a Do Not Contact name can never reach a call
 * sheet either.
 *
 * So this module adds NO second mechanism, NO new field and NO new endpoint. It
 * is the wording and the on/off derivation for a control that sets and clears
 * that one existing label through the endpoints that already back the chip
 * manager — `POST/DELETE /alumni/{id}/status-labels` — which are gated on
 * `RequireAlumniEdit` and which audit BOTH directions (`add_status_label` /
 * `remove_status_label`, stamped with the acting user). Two sources of truth for
 * "never contact this person" is precisely the bug that gets someone emailed
 * after they asked not to be.
 *
 * Kept as a plain `.ts` module (no JSX) so the derivation and the confirm copy
 * are unit-testable in the node-env vitest suite, and so the profile header, the
 * mobile FAB and the tag/status chip manager cannot drift into three different
 * answers about the same label.
 */

import { DO_NOT_CONTACT } from "./tag-tone";

export { DO_NOT_CONTACT };

/**
 * Is this record marked "do not contact"?
 *
 * Compared case- and whitespace-insensitively, matching both `chipTone()` on
 * this side and the backend's `ILIKE` label comparison
 * (`has_status_label_exists`). A label that suppresses the send server-side must
 * never fail to light up the record client-side because of a stray capital.
 */
export function isDoNotContact(
  statusLabels: readonly string[] | null | undefined,
): boolean {
  const target = DO_NOT_CONTACT.toLowerCase();
  return (statusLabels ?? []).some(
    (label) => (label ?? "").trim().toLowerCase() === target,
  );
}

/** Which way the control is about to move the label. */
export type DoNotContactDirection = "set" | "clear";

/** Everything the control renders for one direction. */
export interface DoNotContactCopy {
  /** `set` adds the label, `clear` removes it. */
  direction: DoNotContactDirection;
  /** Label on the trigger button sitting on the record. */
  buttonLabel: string;
  /** Confirm dialog heading. */
  confirmTitle: string;
  /** Confirm dialog body; takes the alum's name so the dialog names who. */
  confirmBody: (name: string) => string;
  /** Confirm dialog's committing button. */
  confirmCta: string;
  /** Committing button while the action is in flight. */
  pendingLabel: string;
  /** Success toast. */
  successToast: (name: string) => string;
  /** Failure toast fallback when the server sends no message. */
  errorFallback: string;
  /**
   * Tone of the committing button. Turning the label OFF is the destructive
   * direction — it re-opens contact to someone who asked not to be contacted —
   * so it, not the protective direction, gets the red button.
   */
  confirmVariant: "primary" | "destructive";
}

/** Fallback subject for the copy when a record has no usable name. */
const UNNAMED = "This alumnus";

function subject(name: string): string {
  const trimmed = (name ?? "").trim();
  return trimmed === "" ? UNNAMED : trimmed;
}

/**
 * The wording for the NEXT action, given the label's CURRENT state.
 *
 * `active === true` means the label is set, so the only move left is to clear
 * it. Both directions confirm — turning it on because it silences every future
 * survey to this person, and turning it off because it is the direction that
 * can actually harm someone. Neither confirm is skippable.
 */
export function doNotContactCopy(active: boolean): DoNotContactCopy {
  if (active) {
    return {
      direction: "clear",
      buttonLabel: "Allow contact again",
      confirmTitle: "Allow contact again",
      confirmBody: (name) =>
        `${subject(name)} is currently marked "Do Not Contact": someone recorded that they asked not to be contacted. ` +
        "Removing the label puts them back into survey sends and follow-up worklists. " +
        "Only do this if you know the request has been withdrawn. " +
        "This change is recorded in the audit trail under your name.",
      confirmCta: "Allow contact again",
      pendingLabel: "Allowing…",
      successToast: (name) =>
        `Do Not Contact removed. ${subject(name)} can be contacted again.`,
      errorFallback: "Failed to remove Do Not Contact.",
      confirmVariant: "destructive",
    };
  }
  return {
    direction: "set",
    buttonLabel: "Mark do not contact",
    confirmTitle: "Mark do not contact",
    confirmBody: (name) =>
      `${subject(name)} will be excluded from every survey send and from the follow-up worklists that go with them. ` +
      "Nothing else on the record changes, and the exclusion lasts until someone removes the label. " +
      "This change is recorded in the audit trail under your name.",
    confirmCta: "Mark do not contact",
    pendingLabel: "Marking…",
    successToast: (name) =>
      `Do Not Contact set. ${subject(name)} is excluded from survey contact.`,
    errorFallback: "Failed to set Do Not Contact.",
    confirmVariant: "primary",
  };
}

/** Banner heading shown on a record carrying the label. */
export const DO_NOT_CONTACT_BANNER_TITLE = "Do not contact";

/**
 * Banner body. Says what is excluded in the same terms the survey console uses,
 * so a staff member reading the record and a staff member reading the held-out
 * list are told the same thing.
 */
export function doNotContactBannerBody(name: string): string {
  return (
    `${subject(name)} has asked not to be contacted. ` +
    "They are excluded from every survey send and from follow-up worklists, and they must not be contacted directly."
  );
}
