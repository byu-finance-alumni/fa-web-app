/**
 * Pure helpers behind the vocabulary-backed dropdowns.
 *
 * Kept in a plain module with no React and no `@/` imports — like
 * `components/alumni/preferred-contact.ts` — so the option-set rules are
 * unit-testable without dragging the `"use client"` hook (and the Supabase
 * client it reaches for) into the test graph. `useVocabOptions` re-exports
 * everything here, so callers keep importing from one place.
 */

/**
 * Ensure a stored value that is no longer in the active vocabulary still
 * appears as a selectable option — kept first so editing an unrelated field
 * doesn't silently overwrite it.
 *
 * This is what keeps a record editable after its stored value leaves the
 * dropdown, which happens two ways:
 *
 *  - The term was hidden or soft-deleted in Admin → Vocabulary.
 *  - The term is still live vocabulary but is withheld from THIS dropdown —
 *    a primary industry of "Law" / "Corporate Banking" / "Sales and Trading" /
 *    "Credit Risk" (#452). The #282 data migration deliberately leaves some
 *    rows holding those (the conflict rows whose secondary slot was already
 *    taken), and the backend still accepts them on write, so the dropdown must
 *    offer the stored one back rather than blank or silently change it.
 */
export function withValue(
  options: readonly string[],
  value: string | null | undefined,
): readonly string[] {
  const v = value?.trim();
  if (v && !options.includes(v)) return [v, ...options];
  return options;
}
