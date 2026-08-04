/**
 * Pure selection logic for the conference-attendee match review (#612).
 *
 * Kept out of the .tsx so it is unit-testable headlessly (the house pattern —
 * see src/lib/photoImport.ts). Everything here is a pure function over the
 * preview payload plus the reviewer's picks.
 *
 * THE INVARIANT this file exists to protect: **nothing is ever selected for the
 * reviewer.** A row is only ever included because a human ticked it. There is
 * deliberately no "select all", no "approve everything above X confidence", and
 * no default selection derived from the backend's score — not even for an
 * email-verified single match. If you are about to add one, re-read #612.
 */

import type {
  AttendeeApproval,
  AttendeeMatchCandidate,
  AttendeeMatchRow,
} from "@/types/attendee-match";

/**
 * What the reviewer has decided about each row, keyed by the 1-based
 * spreadsheet row number.
 *
 * - `{ kind: "approve", alumniId }` — attach THIS record to the event.
 * - `{ kind: "friend" }`            — create a friend record from the file row.
 * - absent                          — undecided; nothing happens to this row.
 *
 * The two are mutually exclusive by construction: `choose` replaces whatever
 * was there, so a row can never be both approved and created as a friend.
 */
export type RowDecision =
  | { kind: "approve"; alumniId: number }
  | { kind: "friend" };

export type Decisions = Readonly<Record<number, RowDecision | undefined>>;

/** The empty starting state — NOTHING pre-selected. */
export const NO_DECISIONS: Decisions = Object.freeze({});

/** Approve a specific candidate for a row (replacing any prior decision). */
export function approveRow(
  decisions: Decisions,
  row: number,
  alumniId: number,
): Decisions {
  return { ...decisions, [row]: { kind: "approve", alumniId } };
}

/** Mark a row for friend creation (replacing any prior decision). */
export function friendRow(decisions: Decisions, row: number): Decisions {
  return { ...decisions, [row]: { kind: "friend" } };
}

/** Undo a row's decision. */
export function clearRow(decisions: Decisions, row: number): Decisions {
  const next = { ...decisions };
  delete next[row];
  return next;
}

/** Toggle a candidate: ticking the already-approved candidate clears the row. */
export function toggleApproval(
  decisions: Decisions,
  row: number,
  alumniId: number,
): Decisions {
  const current = decisions[row];
  if (current?.kind === "approve" && current.alumniId === alumniId) {
    return clearRow(decisions, row);
  }
  return approveRow(decisions, row, alumniId);
}

/** Toggle "create as a friend" for a row. */
export function toggleFriend(decisions: Decisions, row: number): Decisions {
  return decisions[row]?.kind === "friend"
    ? clearRow(decisions, row)
    : friendRow(decisions, row);
}

/**
 * The approvals to POST, derived ONLY from explicit decisions.
 *
 * A decision is dropped when it names a candidate the preview did not actually
 * offer for that row, so a stale selection (the reviewer re-checked the file
 * after picking) can never smuggle an unproposed id into the write.
 */
export function buildApprovals(
  rows: AttendeeMatchRow[],
  decisions: Decisions,
): AttendeeApproval[] {
  const approvals: AttendeeApproval[] = [];
  for (const row of rows) {
    const decision = decisions[row.row];
    if (decision?.kind !== "approve") continue;
    const offered = row.candidates.some(
      (c) => c.alumni_id === decision.alumniId,
    );
    if (!offered) continue;
    approvals.push({ alumni_id: decision.alumniId, row: row.row });
  }
  return approvals;
}

/**
 * The row numbers to create as friends, as the comma-separated form value the
 * backend expects. Only rows still present in the preview are included.
 *
 * A `not_reviewed` row is excluded even if it was somehow ticked: the preview
 * never looked for that person, so "create a friend" would be creating a
 * duplicate of an alumnus nobody checked for.
 */
export function buildFriendRows(
  rows: AttendeeMatchRow[],
  decisions: Decisions,
): number[] {
  return rows
    .filter(
      (row) =>
        decisions[row.row]?.kind === "friend" && row.status !== "not_reviewed",
    )
    .map((row) => row.row);
}

export function friendRowsParam(rowNumbers: number[]): string {
  return rowNumbers.join(",");
}

/** How many rows the reviewer has decided, split by kind. */
export function decisionCounts(
  rows: AttendeeMatchRow[],
  decisions: Decisions,
): { approvals: number; friends: number; total: number } {
  const approvals = buildApprovals(rows, decisions).length;
  const friends = buildFriendRows(rows, decisions).length;
  return { approvals, friends, total: approvals + friends };
}

/** Nothing to submit until a human has decided at least one row. */
export function canApply(
  rows: AttendeeMatchRow[],
  decisions: Decisions,
): boolean {
  return decisionCounts(rows, decisions).total > 0;
}

/** Human label for a row status. */
export function statusLabel(status: string): string {
  switch (status) {
    case "matched":
      return "One possible match";
    case "ambiguous":
      return "Several possible matches";
    case "no_match":
      return "No match found";
    case "not_reviewed":
      return "Not reviewed";
    default:
      return status;
  }
}

/**
 * Badge tone for a row status. `matched` is deliberately NOT a success tone —
 * it is a proposal awaiting a human, and colouring it green invites the reader
 * to treat it as already done.
 */
export function statusTone(status: string): "neutral" | "warning" | "muted" {
  switch (status) {
    case "matched":
      return "neutral";
    case "ambiguous":
      return "warning";
    case "not_reviewed":
      return "warning";
    default:
      return "muted";
  }
}

/** How a candidate was proposed, in words rather than a code. */
export function tierLabel(tier: string): string {
  switch (tier) {
    case "email":
      return "Email match";
    case "name":
      return "Name match";
    case "name_company":
      return "Given name + employer only";
    default:
      return tier;
  }
}

export function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
    default:
      return confidence;
  }
}

/**
 * The one-line context that lets a reviewer tell two people apart: grad year,
 * employer, title, and work location. Empty pieces are dropped rather than
 * rendered as "null".
 */
export function candidateContext(candidate: AttendeeMatchCandidate): string {
  const location = [candidate.city, candidate.state].filter(Boolean).join(", ");
  return [
    candidate.graduation_year ? `Class of ${candidate.graduation_year}` : null,
    candidate.title,
    candidate.employer,
    location || null,
    candidate.net_id ? `Net ID ${candidate.net_id}` : null,
    candidate.is_alumni ? null : "Friend record",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The attendee as the FILE describes them, for side-by-side comparison. */
export function attendeeContext(row: AttendeeMatchRow): string {
  const a = row.attendee;
  return [
    a.email,
    a.title,
    a.company,
    a.graduation_year ? `Class of ${a.graduation_year}` : null,
    a.maiden_name ? `Maiden name ${a.maiden_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** True when every candidate on the row is already on this event's roster. */
export function rowAlreadyAttending(row: AttendeeMatchRow): boolean {
  return (
    row.candidates.length > 0 && row.candidates.every((c) => c.already_attending)
  );
}

export const isCsvFile = (file: File): boolean =>
  file.name.toLowerCase().endsWith(".csv") ||
  file.type === "text/csv" ||
  file.type === "application/vnd.ms-excel";
