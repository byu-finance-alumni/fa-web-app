/**
 * Who to ask for a survey reset when you cannot do it yourself (#658).
 *
 * Resetting one alumnus is engineer-only — the backend enforces
 * `RequireEngineer` on both `GET /survey/alumni/{id}/state` and
 * `POST /survey/alumni/{id}/reset`. Everyone else who reaches the survey
 * screens (full access, super admin) can SEE that someone is held out and can do
 * nothing about it, so the only useful thing the UI can offer them is a name.
 *
 * That name is not hardcoded. It comes from the engineer-managed support
 * contacts (`GET /support-contacts`, the same list the in-app error screen
 * shows), so when the engineer changes, the copy changes with the row rather
 * than with a deploy.
 *
 * The FALLBACK is Jake's instruction (2026-08-07): if no engineer contact is
 * configured, say the Finance Department — in words, with no address. An invented
 * mailbox is worse than none, because a message sent into it looks delivered.
 */
import type { SupportContact } from "@/types/support";

/**
 * The label the engineer's row carries. `role_label` is free text the engineer
 * types (see `SupportContactsManager`), so this is matched loosely rather than
 * compared: the migration seeds it as exactly "Engineer", but "Engineer (BYU)"
 * or "engineer" are the same person and must not fall through to the
 * Finance-Department fallback.
 */
const ENGINEER_LABEL = "engineer";

/**
 * The engineer's support-contact row, or null when none is configured.
 *
 * Ties break on `sort_order` (then id) rather than on array order, so the choice
 * doesn't depend on how the endpoint happened to sort — the engineer controls
 * `sort_order`, and the first one they ordered is the one they meant.
 */
export function engineerSupportContact(
  contacts: readonly SupportContact[] | null | undefined,
): SupportContact | null {
  const matches = (contacts ?? []).filter((c) =>
    c.role_label.toLowerCase().includes(ENGINEER_LABEL),
  );
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.support_contact_id - b.support_contact_id,
  )[0];
}

/** Jake's fallback wording. Plain text — deliberately NOT an email address. */
export const FINANCE_DEPARTMENT = "the Finance Department";

/**
 * Just enough of a support-contact row to address someone. Structural rather
 * than `SupportContact` itself so the confirm-copy module can name a contact
 * without depending on the support-contacts feature's shape.
 */
export type ResetContact = { name: string; email: string };

/**
 * Who to contact, as it reads mid-sentence: "Jane Doe at jane@byu.edu", or the
 * Finance Department when no engineer contact exists. One place, because both
 * the held-out list's hint and the cancel/delete confirms have to name the same
 * person — two spellings of "ask someone else" is how one of them goes stale.
 */
export function resetContactPhrase(
  contact: ResetContact | null | undefined,
): string {
  if (!contact) return FINANCE_DEPARTMENT;
  return `${contact.name} at ${contact.email}`;
}

/**
 * The hint shown in place of the per-alumnus reset control for a non-engineer.
 *
 * Shown INSTEAD OF the button, not on a disabled one: a control that exists but
 * can never work reads as broken, and the useful information is the name, not
 * the greyed-out affordance.
 */
export function resetRequiresEngineerHint(
  contact: ResetContact | null | undefined,
): string {
  return (
    "Only an engineer can reset a survey. Contact " +
    `${resetContactPhrase(contact)} to reset this alum.`
  );
}

/**
 * The same fact one level up, for the panel a non-engineer cannot even list.
 *
 * `GET /survey/campaigns/{year}/held-out` is engineer-gated too, so a
 * non-engineer gets the count and no names at all. Saying only "contact the
 * engineer to reset" there would leave them wondering why the list is empty, so
 * this states both halves.
 */
export function heldOutNamesRequireEngineer(
  contact: ResetContact | null | undefined,
): string {
  return (
    "Only an engineer can see who these alumni are or reset a survey. Contact " +
    `${resetContactPhrase(contact)} to reset an alum.`
  );
}
