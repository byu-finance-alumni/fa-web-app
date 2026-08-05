import type { BadgeProps } from "@/components/ui/badge";

/** The status label that means "never contact this person". */
export const DO_NOT_CONTACT = "Do Not Contact";

/** The status label that mirrors the `alumni.deceased` record flag. */
export const DECEASED = "Deceased";

export type ChipTone = NonNullable<BadgeProps["variant"]>;

/**
 * One tone for every tag, status label and "ways to get involved" chip.
 *
 * Jake's rule (2026-08-05): the chip family is BLUE — the `tag` variant
 * (`blue-50` / `navy-800`). Nothing in it is green, amber or grey, and
 * **"Do Not Contact" is the only red thing on a profile**. Red used to mean
 * nothing in particular here, so a red chip anywhere else buries the one label
 * a staff member must not miss before emailing someone.
 *
 * "Deceased" is the single carve-out and it is NOT red — red is reserved. It
 * keeps the muted grey UX-UI.md already assigns to archived/deceased records,
 * which is exactly the treatment of the record-status badge rendered beside the
 * name for the same fact. Blue would have put "Deceased" in the same visual
 * bucket as "Mentor".
 *
 * Everything else — including the other status labels (Inactive, Lost Contact,
 * Retired) — is blue.
 */
export function chipTone(label: string): ChipTone {
  const value = label.trim().toLowerCase();
  if (value === DO_NOT_CONTACT.toLowerCase()) return "danger";
  if (value === DECEASED.toLowerCase()) return "muted";
  return "tag";
}
