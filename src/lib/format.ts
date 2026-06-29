/**
 * Render a snake_case token as human-readable words, e.g.
 * "remove_attendee" → "remove attendee". Used for audit action/entity labels.
 */
export function humanize(token: string): string {
  return token.replace(/_/g, " ");
}

/**
 * Relative "last contacted" label derived from an ISO timestamp.
 *   null → "Never contacted"; same calendar day → "Today"; 1 → "Yesterday";
 *   otherwise "N days ago". Day count is whole-day difference between the two
 *   calendar dates (local time), so it tracks the date, not exact elapsed hours.
 */
export function daysAgo(iso: string | null): string {
  if (!iso) return "Never contacted";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Never contacted";
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(new Date()) - startOfDay(then)) / 86_400_000,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
