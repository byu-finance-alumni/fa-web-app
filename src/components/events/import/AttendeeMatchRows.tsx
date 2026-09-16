"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  applyOutcomeLabel,
  attendeeContext,
  autoConfirmedCandidate,
  autoConfirmedNote,
  canCreateFriend,
  candidateContext,
  confidenceLabel,
  friendOutcomeLabel,
  rowAlreadyAttending,
  rowStatusLabel,
  statusTone,
  tierLabel,
  type Decisions,
} from "@/lib/attendeeMatch";
import type {
  AttendeeApplyItem,
  AttendeeFriendItem,
  AttendeeMatchCandidate,
  AttendeeMatchRow,
} from "@/types/attendee-match";

/**
 * The per-row pieces of the attendee-match wizard (#612, #537, #538), kept in
 * their own module so they render headlessly in vitest (the wizard itself
 * imports server actions, which the Node test runner cannot load). Text-only
 * controls per the app's no-icons preference.
 */

/** Name, tier / confidence badges, context and evidence for one candidate. */
function CandidateSummary({ candidate }: { candidate: AttendeeMatchCandidate }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2">
        <Link
          href={`/alumni/${candidate.alumni_id}`}
          target="_blank"
          className="font-medium text-brand-blue-700 underline-offset-2 hover:underline"
        >
          {candidate.name}
        </Link>
        <Badge variant="neutral" size="sm">
          {tierLabel(candidate.tier)}
        </Badge>
        <Badge
          variant={candidate.confidence === "low" ? "warning" : "muted"}
          size="sm"
        >
          {confidenceLabel(candidate.confidence)}
        </Badge>
        {candidate.already_attending ? (
          <Badge variant="muted" size="sm">
            Already on this roster
          </Badge>
        ) : null}
      </span>
      <span className="mt-1 block text-sm text-gray-600">
        {candidateContext(candidate)}
      </span>
      {candidate.birth_name ? (
        <span className="mt-1 block text-sm text-gray-600">
          Also recorded as {candidate.birth_name}
        </span>
      ) : null}
      {candidate.personal_email || candidate.work_email ? (
        <span className="mt-1 block text-sm text-gray-600">
          {candidate.personal_email ?? candidate.work_email}
        </span>
      ) : null}
      <ul className="mt-2 space-y-0.5 text-xs text-gray-500">
        {candidate.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </span>
  );
}

/**
 * One proposed record, with the evidence for AND against it. Selecting is a
 * plain checkbox per candidate — never a pre-ticked default, and never a
 * "select all" — so every attendance row traces to a deliberate click.
 */
export function CandidateRow({
  candidate,
  selected,
  onToggle,
}: {
  candidate: AttendeeMatchCandidate;
  selected: boolean;
  onToggle: () => void;
}) {
  const disabled = candidate.already_attending;
  return (
    <li className="rounded-md border border-gray-200 bg-white p-3">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-brand-blue-600"
          checked={selected}
          disabled={disabled}
          onChange={onToggle}
        />
        <CandidateSummary candidate={candidate} />
      </label>
    </li>
  );
}

/**
 * A row the preview confirmed on Net ID (#537). Rendered as a settled fact —
 * no checkbox, nothing to decide — with the backend's own verdict underneath
 * so a Net ID that matched while the email or name disagreed is still visible.
 */
function ConfirmedRow({
  row,
  candidate,
}: {
  row: AttendeeMatchRow;
  candidate: AttendeeMatchCandidate;
}) {
  const note = autoConfirmedNote(row);
  return (
    <>
      <p className="mt-3 text-sm text-gray-700">
        Matched by Net ID. This attendee will be added when you apply; there is
        nothing to approve.
      </p>
      {note ? <p className="mt-1 text-sm text-gray-600">{note}</p> : null}
      <ul className="mt-3 space-y-2">
        <li className="rounded-md border border-gray-200 bg-white p-3">
          <div className="flex items-start gap-3">
            <CandidateSummary candidate={candidate} />
          </div>
        </li>
      </ul>
    </>
  );
}

export function ReviewRow({
  row,
  decisions,
  onToggleCandidate,
  onToggleFriend,
}: {
  row: AttendeeMatchRow;
  decisions: Decisions;
  onToggleCandidate: (alumniId: number) => void;
  onToggleFriend: () => void;
}) {
  const decision = decisions[row.row];
  const context = attendeeContext(row);
  const confirmed = autoConfirmedCandidate(row);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs tabular-nums text-gray-500">
          Row {row.row}
        </span>
        <span className="font-semibold text-navy-900">
          {row.attendee.name}
        </span>
        <Badge variant={statusTone(row.status)} size="sm">
          {rowStatusLabel(row)}
        </Badge>
        {rowAlreadyAttending(row) ? (
          <Badge variant="muted" size="sm">
            Already on this roster
          </Badge>
        ) : null}
      </div>
      {context ? (
        <p className="mt-1 text-sm text-gray-600">From the file: {context}</p>
      ) : null}
      {row.warnings.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-sm text-warning-700">
          {row.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {confirmed ? (
        <ConfirmedRow row={row} candidate={confirmed} />
      ) : row.candidates.length > 0 ? (
        <>
          {row.status === "ambiguous" ? (
            <p className="mt-3 text-sm text-warning-700">
              Several people could be this attendee. Choose the right one, or
              leave them all unticked and decide later. Nothing is recorded
              until you approve it.
            </p>
          ) : null}
          {/* The backend's one-line verdict — for an ambiguous row this is
              how a Net ID pointing at one record while the email or name
              points at another is explained. Shown verbatim. */}
          {row.reason ? (
            <p className="mt-2 text-sm text-gray-600">{row.reason}</p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {row.candidates.map((candidate) => (
              <CandidateRow
                key={candidate.alumni_id}
                candidate={candidate}
                selected={
                  decision?.kind === "approve" &&
                  decision.alumniId === candidate.alumni_id
                }
                onToggle={() => onToggleCandidate(candidate.alumni_id)}
              />
            ))}
          </ul>
        </>
      ) : (
        <>
          {row.reason ? (
            <p className="mt-3 text-sm text-gray-600">{row.reason}</p>
          ) : null}
          <p className="mt-3 text-sm text-gray-600">
            Nobody in the database plausibly matches this attendee. Most likely
            they didn&apos;t graduate from BYU.
          </p>
        </>
      )}

      {/* Offered ONLY when the row failed every tier (`friend_eligible`,
          #537). A row that matched on email or name but has no Net ID is not
          eligible — a friend built from it would duplicate an alumnus. A
          not_reviewed row was never looked up, so it is not eligible either. */}
      {canCreateFriend(row) ? (
        <label className="mt-3 flex items-start gap-3 rounded-md border border-dashed border-gray-300 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-brand-blue-600"
            checked={decision?.kind === "friend"}
            onChange={onToggleFriend}
          />
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-medium text-navy-900">
              Create a friend-of-the-program record instead
            </span>
            <span className="mt-1 block text-gray-600">
              {row.friend_fields.length > 0
                ? `Will store: ${row.friend_fields.join(", ")}`
                : "Nothing in this row maps to a stored field."}
            </span>
          </span>
        </label>
      ) : null}
    </Card>
  );
}

/** The Done step's per-approval outcomes, statuses in words. */
export function ApplyOutcomes({ items }: { items: AttendeeApplyItem[] }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-navy-900">Matches</h3>
      <ul className="mt-2 space-y-1 text-sm text-gray-600">
        {items.map((item) => (
          <li key={`a-${item.alumni_id}-${item.row ?? ""}`}>
            {item.row !== null ? `Row ${item.row}: ` : ""}
            {item.name ?? `Alumni #${item.alumni_id}`}: {applyOutcomeLabel(item.status)}
            {item.message ? ` (${item.message})` : ""}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The Done step's per-row friend outcomes (#538). */
export function FriendOutcomes({ items }: { items: AttendeeFriendItem[] }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-navy-900">Friend records</h3>
      <ul className="mt-2 space-y-1 text-sm text-gray-600">
        {items.map((item) => (
          <li key={`f-${item.row}`}>
            Row {item.row}: {item.name}: {friendOutcomeLabel(item)}
            {item.message ? ` (${item.message})` : ""}
          </li>
        ))}
      </ul>
    </Card>
  );
}
