"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  approveAttendeeMatches,
  createAttendeeFriends,
  downloadAttendeeMatchTemplate,
  previewAttendeeMatch,
} from "@/app/(app)/events/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  NO_DECISIONS,
  attendeeContext,
  buildApprovals,
  buildFriendRows,
  candidateContext,
  canApply,
  confidenceLabel,
  decisionCounts,
  isCsvFile,
  rowAlreadyAttending,
  statusLabel,
  statusTone,
  tierLabel,
  toggleApproval,
  toggleFriend,
  type Decisions,
} from "@/lib/attendeeMatch";
import type {
  AttendeeApplyResult,
  AttendeeFriendResult,
  AttendeeMatchCandidate,
  AttendeeMatchPreview,
  AttendeeMatchRow,
} from "@/types/attendee-match";

type Step = "upload" | "review" | "result";

function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StepHeader({
  step,
  eventName,
}: {
  step: Step;
  eventName: string;
}) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Upload the list" },
    { key: "review", label: "2. Review and approve" },
    { key: "result", label: "3. Done" },
  ];
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-navy-900">
        Match attendees to alumni — {eventName}
      </h2>
      <ol className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {steps.map((s) => (
          <li
            key={s.key}
            className={
              s.key === step
                ? "font-semibold text-brand-blue-700"
                : "text-gray-500"
            }
          >
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "muted";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning-700"
      : tone === "muted"
        ? "text-gray-500"
        : "text-navy-900";
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </Card>
  );
}

/**
 * One proposed record, with the evidence for AND against it. Selecting is a
 * plain checkbox per candidate — never a pre-ticked default, and never a
 * "select all" — so every attendance row traces to a deliberate click.
 */
function CandidateRow({
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
      </label>
    </li>
  );
}

function ReviewRow({
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
          {statusLabel(row.status)}
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

      {row.candidates.length > 0 ? (
        <>
          {row.status === "ambiguous" ? (
            <p className="mt-3 text-sm text-warning-700">
              Several people could be this attendee. Choose the right one, or
              leave them all unticked and decide later — nothing is recorded
              until you approve it.
            </p>
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
        <p className="mt-3 text-sm text-gray-600">
          Nobody in the database plausibly matches this attendee — most likely
          they didn&apos;t graduate from BYU.
        </p>
      )}

      {/* A not_reviewed row was never looked up, so offering "create a friend"
          would invite a duplicate of somebody nobody checked for. */}
      {row.status === "not_reviewed" ? null : (
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
      )}
    </Card>
  );
}

/**
 * Review a conference attendee list against the alumni database and approve
 * matches one at a time (#612).
 *
 * Conference registrations don't collect Net IDs, so this matches on email
 * first and name second. Everything the backend returns is a PROPOSAL:
 * nothing is pre-selected here, there is no "select all" and no
 * approve-above-a-confidence shortcut, and an ambiguous row shows every
 * candidate rather than silently picking the top-scoring one. Text-only
 * controls per the app's no-icons preference.
 */
export function AttendeeMatchWizard({
  eventId,
  eventName,
}: {
  eventId: number;
  eventName: string;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<AttendeeMatchPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  const [decisions, setDecisions] = useState<Decisions>(NO_DECISIONS);

  const [applyResult, setApplyResult] = useState<AttendeeApplyResult | null>(
    null,
  );
  const [friendResult, setFriendResult] =
    useState<AttendeeFriendResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, startApplying] = useTransition();

  const [templateError, setTemplateError] = useState<string | null>(null);
  const [downloadingTemplate, startTemplate] = useTransition();

  const rows = useMemo(() => preview?.rows ?? [], [preview]);
  const counts = decisionCounts(rows, decisions);
  const ready = canApply(rows, decisions);

  const pickFile = (next: File | null) => {
    setPreview(null);
    setPreviewError(null);
    setDecisions(NO_DECISIONS);
    setApplyResult(null);
    setFriendResult(null);
    setApplyError(null);
    if (!next) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (!isCsvFile(next)) {
      setFile(null);
      setFileError("That isn't a .csv file. Choose a CSV export.");
      return;
    }
    setFileError(null);
    setFile(next);
  };

  const onCheck = () => {
    if (!file) return;
    setPreviewError(null);
    startChecking(async () => {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const state = await previewAttendeeMatch(eventId, fd);
      if (!state.ok) {
        setPreviewError(state.error);
        return;
      }
      setPreview(state.data);
      setDecisions(NO_DECISIONS);
      if (state.data.columns_ok) setStep("review");
    });
  };

  const onApply = () => {
    if (!file || !ready) return;
    setApplyError(null);
    startApplying(async () => {
      const approvals = buildApprovals(rows, decisions);
      const friendRows = buildFriendRows(rows, decisions);
      let failed: string | null = null;

      if (approvals.length > 0) {
        const state = await approveAttendeeMatches(eventId, approvals);
        if (state.ok) setApplyResult(state.data);
        else failed = state.error;
      }
      if (!failed && friendRows.length > 0) {
        const fd = new FormData();
        fd.append("file", file, file.name);
        const state = await createAttendeeFriends(eventId, friendRows, fd);
        if (state.ok) setFriendResult(state.data);
        else failed = state.error;
      }
      if (failed) setApplyError(failed);
      else setStep("result");
    });
  };

  const onTemplate = () => {
    setTemplateError(null);
    startTemplate(async () => {
      const state = await downloadAttendeeMatchTemplate();
      if (!state.ok) {
        setTemplateError(state.error);
        return;
      }
      downloadCsv("conference_attendees_template.csv", state.csv);
    });
  };

  const restart = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setDecisions(NO_DECISIONS);
    setApplyResult(null);
    setFriendResult(null);
    setApplyError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="w-full max-w-5xl space-y-6">
      <StepHeader step={step} eventName={eventName} />

      {step === "upload" ? (
        <Card className="space-y-4 p-6">
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Upload the conference registration list. Net IDs are not needed —
              attendees are matched on their <strong>email</strong> when the
              file has one, and on their <strong>name</strong> when it
              doesn&apos;t, with the company used as supporting evidence.
            </p>
            <p>
              Column names don&apos;t have to match anything: Email, E-mail
              Address, Company, Employer, Organization, Job Title and a combined
              Name column are all understood, and columns we don&apos;t
              recognise are simply ignored.
            </p>
            <p>
              Every match is a <strong>proposal</strong>. Nothing is recorded
              until you approve it on the next screen.
            </p>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
              dragOver
                ? "border-brand-blue-500 bg-brand-blue-50"
                : "border-gray-300 bg-gray-50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm font-medium text-navy-900">
              {file ? file.name : "Drop the attendee CSV here, or click to choose"}
            </span>
            <span className="mt-1 text-xs text-gray-500">
              CSV only, up to 4 MB and 2,000 attendees per file
            </span>
          </label>

          {fileError ? (
            <p className="text-sm text-danger-600">{fileError}</p>
          ) : null}
          {previewError ? (
            <p className="text-sm text-danger-600">{previewError}</p>
          ) : null}
          {preview && !preview.columns_ok ? (
            <ul className="space-y-1 text-sm text-danger-600">
              {preview.header_errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {templateError ? (
            <p className="text-sm text-danger-600">{templateError}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button onClick={onCheck} disabled={!file || checking}>
              {checking ? "Checking…" : "Check the list"}
            </Button>
            <Button
              variant="secondary"
              onClick={onTemplate}
              disabled={downloadingTemplate}
            >
              {downloadingTemplate ? "Downloading…" : "Download an example CSV"}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/events">Cancel</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "review" && preview ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            <SummaryCard label="Rows in file" value={preview.summary.total_rows} />
            <SummaryCard label="One match" value={preview.summary.matched} />
            <SummaryCard
              label="Several matches"
              value={preview.summary.ambiguous}
              tone="warning"
            />
            <SummaryCard
              label="No match"
              value={preview.summary.no_match}
              tone="muted"
            />
            <SummaryCard
              label="Not reviewed"
              value={preview.summary.not_reviewed}
              tone="warning"
            />
            <SummaryCard
              label="Already attending"
              value={preview.summary.already_attending}
              tone="muted"
            />
          </div>

          {preview.ignored_columns.length > 0 ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Columns ignored (they don&apos;t match anything we store):{" "}
              {preview.ignored_columns.join(", ")}.
            </p>
          ) : null}
          {preview.warnings.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700">
              {preview.warnings.map((w) => (
                <li key={w.code + w.message}>{w.message}</li>
              ))}
            </ul>
          ) : null}

          <p className="text-sm text-gray-600">
            Nothing below is selected for you, and there is no “approve
            everything” button on purpose — a wrong match silently credits the
            wrong person. Tick the record you are confident about, or tick
            “create a friend record” for someone who isn&apos;t in the database.
          </p>

          <div className="space-y-4">
            {rows.map((row) => (
              <ReviewRow
                key={row.row}
                row={row}
                decisions={decisions}
                onToggleCandidate={(alumniId) =>
                  setDecisions((d) => toggleApproval(d, row.row, alumniId))
                }
                onToggleFriend={() =>
                  setDecisions((d) => toggleFriend(d, row.row))
                }
              />
            ))}
          </div>

          {applyError ? (
            <p className="text-sm text-danger-600">{applyError}</p>
          ) : null}

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-gray-200 bg-white/95 py-4">
            <span className="text-sm text-gray-600">
              {counts.approvals} match
              {counts.approvals === 1 ? "" : "es"} approved, {counts.friends}{" "}
              friend record{counts.friends === 1 ? "" : "s"} to create
            </span>
            <Button onClick={onApply} disabled={!ready || applying}>
              {applying ? "Saving…" : `Apply ${counts.total} decision${counts.total === 1 ? "" : "s"}`}
            </Button>
            <Button variant="secondary" onClick={restart} disabled={applying}>
              Start over
            </Button>
          </div>
        </div>
      ) : null}

      {step === "result" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <SummaryCard label="Attendees added" value={applyResult?.added ?? 0} />
            <SummaryCard
              label="Already attending"
              value={applyResult?.already_attending ?? 0}
              tone="muted"
            />
            <SummaryCard
              label="Friends created"
              value={friendResult?.created ?? 0}
            />
            <SummaryCard
              label="Already on roster"
              value={friendResult?.skipped ?? 0}
              tone="muted"
            />
            <SummaryCard
              label="Not saved"
              value={(applyResult?.not_found ?? 0) + (friendResult?.rejected ?? 0)}
              tone="warning"
            />
          </div>

          {applyResult && applyResult.items.length > 0 ? (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-navy-900">
                Approved matches
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {applyResult.items.map((item) => (
                  <li key={`a-${item.alumni_id}`}>
                    {item.name ?? `Alumni #${item.alumni_id}`} — {item.status}
                    {item.message ? ` (${item.message})` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {friendResult && friendResult.items.length > 0 ? (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-navy-900">
                Friend records
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {friendResult.items.map((item) => (
                  <li key={`f-${item.row}`}>
                    Row {item.row}: {item.name} — {item.status}
                    {item.message ? ` (${item.message})` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/events/${eventId}/edit`}>Back to the event</Link>
            </Button>
            <Button variant="secondary" onClick={restart}>
              Upload another list
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
