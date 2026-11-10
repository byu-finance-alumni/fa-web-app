/**
 * Pure helpers for the "Email the link" card on the staff "New people" tab
 * (api#661 add-on). No React, no network, so they test directly.
 *
 * The server is the authority on what gets sent: it validates, dedupes, and
 * skips addresses already in the database or invited in the last 30 days. The
 * client count here only feeds the confirm text ("Send the survey link to N
 * addresses?"), so it is a ROUGH count of unique pasted tokens, not a promise.
 */
import type {
  NewPeopleInviteResult,
  NewPeopleInviteSkipReason,
} from "@/types/new-people-survey";

/** The most unique addresses one send accepts (the server enforces it too). */
export const INVITE_MAX_ADDRESSES = 50;

/** The request body's cap on the raw pasted text (matches the server). */
export const INVITE_MAX_CHARS = 20_000;

/** Split pasted text on any mix of commas, semicolons, spaces and newlines. */
export function inviteTokens(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/** Unique tokens, normalised (lowercased, trimmed), in first-seen order. */
export function uniqueInviteTokens(text: string): string[] {
  return [...new Set(inviteTokens(text))];
}

/** The rough number of addresses a send would go to, for the confirm text. */
export function inviteCount(text: string): number {
  return uniqueInviteTokens(text).length;
}

export function inviteConfirmText(count: number): string {
  return `Send the survey link to ${count} ${count === 1 ? "address" : "addresses"}?`;
}

export function inviteSentText(sent: number): string {
  return `Sent to ${sent}.`;
}

/** Plain labels for why an address was not emailed. */
export const INVITE_SKIP_LABELS: Record<NewPeopleInviteSkipReason, string> = {
  invalid: "Not a valid email",
  duplicate: "Listed twice",
  in_database: "Already in the database",
  recently_invited: "Already sent in the last 30 days",
};

/** Display order for the skipped groups. */
const SKIP_ORDER: NewPeopleInviteSkipReason[] = [
  "invalid",
  "duplicate",
  "in_database",
  "recently_invited",
];

export interface InviteSkipGroup {
  reason: NewPeopleInviteSkipReason;
  label: string;
  emails: string[];
}

/** The skipped addresses grouped by reason, empty groups dropped. */
export function groupSkipped(skipped: NewPeopleInviteResult["skipped"]): InviteSkipGroup[] {
  return SKIP_ORDER.map((reason) => ({
    reason,
    label: INVITE_SKIP_LABELS[reason],
    emails: skipped.filter((s) => s.reason === reason).map((s) => s.email),
  })).filter((g) => g.emails.length > 0);
}
