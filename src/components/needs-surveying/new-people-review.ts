/**
 * Pure helpers for the staff "New people" tab (api#661): the shared link card
 * and the review queue. No React, no network, so they test directly.
 */
import type {
  NewPersonApproveRequest,
  NewPersonKind,
  NewPersonPossibleMatch,
  NewPersonSubmissionItem,
} from "@/types/new-people-survey";

/** What a 409 on approve means, in the reviewer's words. */
export const NEW_PERSON_STALE_MESSAGE =
  "This submission changed since you opened it";

/** One reviewer decision on a queued submission. */
export type NewPersonDecision =
  | { action: "create"; kind: NewPersonKind }
  | { action: "merge"; alumniId: number };

/**
 * The approve body. `submitted_at` is ALWAYS the value the card was rendered
 * from, which is the server's stale check: if the row changed underneath the
 * reviewer, the server answers 409 instead of applying the wrong answers.
 */
export function approveRequestBody(
  item: Pick<NewPersonSubmissionItem, "submitted_at">,
  decision: NewPersonDecision,
): NewPersonApproveRequest {
  return decision.action === "create"
    ? {
        action: "create",
        kind: decision.kind,
        alumni_id: null,
        submitted_at: item.submitted_at,
      }
    : {
        action: "merge",
        kind: null,
        alumni_id: decision.alumniId,
        submitted_at: item.submitted_at,
      };
}

export function kindLabel(kind: NewPersonKind): string {
  return kind === "alum" ? "BYU alum" : "Non-BYU professional (friend)";
}

export function matchReasonLabel(reason: NewPersonPossibleMatch["match_reason"]): string {
  return reason === "email" ? "Same email" : "Similar name";
}

/** The match's profile page: friends live under /friends, alumni under /alumni. */
export function matchProfileHref(match: NewPersonPossibleMatch): string {
  return `${match.is_friend ? "/friends" : "/alumni"}/${match.alumni_id}`;
}

/** "Update Jane Doe" — the merge button's label. */
export function mergeButtonLabel(match: NewPersonPossibleMatch): string {
  return `Update ${match.name}`;
}

/** The toast after a successful approve. */
export function approvedMessage(
  item: Pick<NewPersonSubmissionItem, "name" | "comments">,
  decision: NewPersonDecision,
  mergedName?: string,
): string {
  const base =
    decision.action === "create"
      ? `Added ${item.name} as ${decision.kind === "alum" ? "an alum" : "a friend"}.`
      : `Updated ${mergedName ?? "the record"} with ${item.name}'s answers.`;
  return item.comments && item.comments.trim()
    ? `${base} Their comment was saved as a note on the profile.`
    : base;
}

/** `Mar 4, 2026`, or "" for an unparseable timestamp. */
export function formatSubmittedDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
