/**
 * Pure selection logic for the conference-attendee match review (#612, #537).
 *
 * Kept out of the .tsx so it is unit-testable headlessly (the house pattern —
 * see src/lib/photoImport.ts). Everything here is a pure function over the
 * preview payload plus the reviewer's picks.
 *
 * THE INVARIANT this file exists to protect: **nothing is ever selected for the
 * reviewer.** A proposed row is only ever included because a human ticked it.
 * There is deliberately no "select all", no "approve everything above X
 * confidence", and no default selection derived from the backend's score — not
 * even for an email-verified single match. If you are about to add one, re-read
 * #612.
 *
 * The ONE thing that is not a selection: a row the backend reports
 * `auto_confirmed` (#537). That is an exact Net ID hit — an identifier, not a
 * score — and Jake's call was "if the Net ID matches then no need to approve".
 * Those rows are never offered a checkbox; they are always sent, each carrying
 * the row's `net_id` so the server re-verifies it before writing. Everything
 * else (email, name) is still a proposal a human must tick.
 */

import type {
  AttendeeApproval,
  AttendeeFriendItem,
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
 * The approvals to POST: every `auto_confirmed` Net ID row (with its `net_id`,
 * which the server re-verifies), plus the rows a human explicitly decided.
 *
 * A decision is dropped when it names a candidate the preview did not actually
 * offer for that row, so a stale selection (the reviewer re-checked the file
 * after picking) can never smuggle an unproposed id into the write. A human
 * decision on an auto-confirmed row is ignored too: there is no checkbox to
 * make one, and the Net ID path must be the only way such a row is written.
 */
export function buildApprovals(
  rows: AttendeeMatchRow[],
  decisions: Decisions,
): AttendeeApproval[] {
  const approvals: AttendeeApproval[] = [];
  for (const row of rows) {
    const auto = autoConfirmedApproval(row);
    if (auto) {
      approvals.push(auto);
      continue;
    }
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

/** The backend compares Net IDs case-insensitively and ignores surrounding
 *  whitespace; send the same normalised form so a `netid` column typed as
 *  "  MSmith " still verifies. */
export function normalizeNetId(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  return s || null;
}

/**
 * The Net ID candidate an `auto_confirmed` row confirms, or null when the row
 * is not auto-confirmed (or lacks what the server needs to re-verify it — a
 * row without a Net ID to send is NOT quietly downgraded to a human approval).
 */
export function autoConfirmedCandidate(
  row: AttendeeMatchRow,
): AttendeeMatchCandidate | null {
  if (!row.auto_confirmed) return null;
  return (
    row.candidates.find((c) => c.tier === "netid") ?? row.candidates[0] ?? null
  );
}

function autoConfirmedApproval(row: AttendeeMatchRow): AttendeeApproval | null {
  const candidate = autoConfirmedCandidate(row);
  if (!candidate) return null;
  const netId =
    normalizeNetId(row.attendee.net_id) ?? normalizeNetId(candidate.net_id);
  if (!netId) return null;
  return { alumni_id: candidate.alumni_id, row: row.row, net_id: netId };
}

/** Rows the preview confirmed on Net ID — added without review (#537). */
export function autoConfirmedRows(rows: AttendeeMatchRow[]): AttendeeMatchRow[] {
  return rows.filter((row) => autoConfirmedApproval(row) !== null);
}

/**
 * Whether a row may become a friend-of-the-program record: only when the
 * backend says it failed EVERY tier (`friend_eligible`, #537). A row that
 * merely lacks a Net ID but matched on email or name is NOT eligible — a friend
 * built from it would be a twin of an alumnus who is already in the database.
 *
 * A `not_reviewed` row is excluded as well: the preview never looked for that
 * person, so "create a friend" would be creating a duplicate of an alumnus
 * nobody checked for.
 */
export function canCreateFriend(row: AttendeeMatchRow): boolean {
  return row.friend_eligible && row.status !== "not_reviewed";
}

/**
 * The row numbers to create as friends, as the comma-separated form value the
 * backend expects. Only rows still present in the preview AND still eligible
 * are included, so a ticked row cannot outlive its eligibility.
 */
export function buildFriendRows(
  rows: AttendeeMatchRow[],
  decisions: Decisions,
): number[] {
  return rows
    .filter((row) => decisions[row.row]?.kind === "friend" && canCreateFriend(row))
    .map((row) => row.row);
}

export function friendRowsParam(rowNumbers: number[]): string {
  return rowNumbers.join(",");
}

/**
 * What will be written when the reviewer applies, split by kind.
 * `approvals` counts only the rows a HUMAN ticked; `autoConfirmed` is the Net
 * ID rows that go without review; `total` is everything the apply call sends.
 */
export function decisionCounts(
  rows: AttendeeMatchRow[],
  decisions: Decisions,
): {
  approvals: number;
  autoConfirmed: number;
  friends: number;
  total: number;
} {
  const autoConfirmed = autoConfirmedRows(rows).length;
  const approvals = buildApprovals(rows, decisions).length - autoConfirmed;
  const friends = buildFriendRows(rows, decisions).length;
  return {
    approvals,
    autoConfirmed,
    friends,
    total: approvals + autoConfirmed + friends,
  };
}

/**
 * Nothing to submit until there is at least one row to write: a human
 * decision, or a Net ID row the preview confirmed (a file of nothing but Net
 * ID hits needs no clicks at all — that is the point of #537).
 */
export function canApply(
  rows: AttendeeMatchRow[],
  decisions: Decisions,
): boolean {
  return decisionCounts(rows, decisions).total > 0;
}

/**
 * Human label for a row. An auto-confirmed row is `matched` on the wire but is
 * not "one possible match" — it is settled, and the label must not invite a
 * review that has nothing to decide.
 */
export function rowStatusLabel(row: AttendeeMatchRow): string {
  return row.auto_confirmed ? "Matched by Net ID" : statusLabel(row.status);
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
    case "netid":
      return "Net ID match";
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
    case "certain":
      return "Certain";
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
 * The note under an auto-confirmed row. The backend's `reason` is the verdict
 * in its own words and is shown verbatim when present; the fallback only says
 * what `corroborated` alone can: whether the email / name agreed too.
 */
export function autoConfirmedNote(row: AttendeeMatchRow): string | null {
  if (row.reason) return row.reason;
  const candidate = autoConfirmedCandidate(row);
  if (!candidate) return null;
  return candidate.corroborated
    ? null
    : "Only the Net ID matched; the email and name on this row did not agree with the record.";
}

/** Per-approval outcome (`AttendeeApplyItem.status`) in words. */
export function applyOutcomeLabel(status: string): string {
  switch (status) {
    case "added":
      return "Added";
    case "already_attending":
      return "Already on this roster";
    case "not_found":
      return "Not found";
    case "net_id_mismatch":
      return "Refused: the Net ID on file no longer matched";
    default:
      return status;
  }
}

/**
 * Per-row friend outcome (`AttendeeFriendItem`) in words. A reused friend is
 * named by its visible id ("Linked existing friend FRIEND-00042") so staff can
 * find the record that was linked instead of a twin being created (#538).
 */
export function friendOutcomeLabel(item: AttendeeFriendItem): string {
  switch (item.status) {
    case "created":
      return item.friend_id
        ? `Created friend ${item.friend_id}`
        : "Created a friend record";
    case "reused":
      return item.friend_id
        ? `Linked existing friend ${item.friend_id}`
        : "Linked an existing friend record";
    case "existing_alumnus":
      return "This email belongs to an alumnus. Match them instead of creating a friend.";
    case "skipped":
      return "Already on this roster";
    case "rejected":
      return "Not saved";
    default:
      return item.status;
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
    a.net_id ? `Net ID ${a.net_id}` : null,
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
