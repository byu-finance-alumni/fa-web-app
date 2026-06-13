/**
 * Render a snake_case token as human-readable words, e.g.
 * "remove_attendee" → "remove attendee". Used for audit action/entity labels.
 */
export function humanize(token: string): string {
  return token.replace(/_/g, " ");
}
