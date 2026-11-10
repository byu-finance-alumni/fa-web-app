/**
 * Pure helpers for the staff "New people" tab (api#661): the shared link card
 * and the review queue. No React, no network, so they test directly.
 */
import type {
  NewPersonApproveRequest,
  NewPersonKind,
  NewPersonMergePreview,
  NewPersonPossibleMatch,
  NewPersonSubmissionItem,
} from "@/types/new-people-survey";

/** What a 409 on approve means, in the reviewer's words. */
export const NEW_PERSON_STALE_MESSAGE =
  "This submission changed since you opened it";

/** One reviewer decision on a queued submission. */
export type NewPersonDecision =
  | { action: "create"; kind: NewPersonKind }
  | {
      action: "merge";
      alumniId: number;
      /** Populated fields the reviewer ticked "Replace" on. Blanks fill regardless. */
      overwriteFields?: string[];
    };

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
        overwrite_fields: [...(decision.overwriteFields ?? [])],
      };
}

export function kindLabel(kind: NewPersonKind): string {
  return kind === "alum" ? "BYU alum" : "Non-BYU professional (friend)";
}

/**
 * Why a record is offered as a match. `byu_id` is accepted ahead of the
 * generated enum (api#661 matches on an active record's BYU ID too), so a BYU
 * ID match never reads as "Similar name".
 */
export function matchReasonLabel(
  reason: NewPersonPossibleMatch["match_reason"] | "byu_id",
): string {
  if (reason === "byu_id") return "Same BYU ID";
  return reason === "email" ? "Same email" : "Similar name";
}

/**
 * Labels the staff queue and merge preview always use for these keys. Every
 * other key shows the server's label (or the raw key when it sent none).
 */
const STAFF_FIELD_LABELS: Readonly<Record<string, string>> = {
  "new.byu_id": "BYU ID",
};

export function submissionFieldLabel(fieldKey: string, serverLabel?: string | null): string {
  return STAFF_FIELD_LABELS[fieldKey] ?? ((serverLabel ?? "").trim() || fieldKey);
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

/* ------------------------------------------------- merge review (round 2) -- */

/**
 * What a merge does to one row of the preview: a blank on the record is FILLED
 * automatically; a populated one is only REPLACED when the reviewer ticks it.
 */
export function mergeRowKind(
  preview: Pick<NewPersonMergePreview, "overwrites">,
  fieldKey: string,
): "fill" | "overwrite" {
  return preview.overwrites.includes(fieldKey) ? "overwrite" : "fill";
}

/**
 * `overwrite_fields` for the approve body: the ticked keys that the preview
 * actually lists as overwrites, in the preview's order. A stale tick for a key
 * that is no longer an overwrite is dropped rather than sent.
 */
export function overwriteFieldsFrom(
  preview: Pick<NewPersonMergePreview, "overwrites">,
  checked: ReadonlySet<string>,
): string[] {
  return preview.overwrites.filter((k) => checked.has(k));
}

/** Email fields carry a caution: they decide where future surveys go. */
export function isEmailField(fieldKey: string): boolean {
  return /email/i.test(fieldKey.split(".").pop() ?? "");
}

export const EMAIL_CHANGE_CAUTION = "Changing an email changes where future surveys go.";

export const DECEASED_MESSAGE = "This person is marked deceased";

/**
 * The approve result's `warnings`, in the reviewer's words. Unknown codes are
 * shown as they came rather than dropped, so a new server warning is not lost.
 */
export function approveWarningsText(
  warnings: readonly string[] | null | undefined,
  submittedKind: NewPersonKind,
): string[] {
  return (warnings ?? []).map((w) =>
    w === "kind_mismatch"
      ? `Note: submitted as ${submittedKind === "friend" ? "a friend" : "an alum"} but merged into a record of the other kind.`
      : `Note: ${w}`,
  );
}

/* --------------------------------------------------- selection (round 2) -- */

/** Most ids one bulk-reject call accepts. */
export const BULK_REJECT_MAX = 500;

export function toggleSelected(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** "Select all": every id if any is unselected, otherwise none. */
export function toggleAll(
  selected: ReadonlySet<number>,
  ids: readonly number[],
): Set<number> {
  return ids.length > 0 && ids.every((id) => selected.has(id)) ? new Set() : new Set(ids);
}

/** The selection limited to ids still in the queue, so a gone card can't be rejected. */
export function pruneSelection(
  selected: ReadonlySet<number>,
  ids: readonly number[],
): Set<number> {
  const present = new Set(ids);
  return new Set([...selected].filter((id) => present.has(id)));
}

/** Ids in chunks the bulk endpoint accepts (1–500 each). */
export function bulkRejectChunks(ids: readonly number[]): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += BULK_REJECT_MAX) {
    chunks.push(ids.slice(i, i + BULK_REJECT_MAX));
  }
  return chunks;
}
