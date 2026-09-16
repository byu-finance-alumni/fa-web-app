"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  approveAttendeeMatches,
  createAttendeeFriends,
  downloadAttendeeMatchTemplate,
  previewAttendeeMatch,
} from "@/app/(app)/events/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ApplyOutcomes,
  FriendOutcomes,
  ReviewRow,
} from "@/components/events/import/AttendeeMatchRows";
import {
  NO_DECISIONS,
  buildApprovals,
  buildFriendRows,
  canApply,
  decisionCounts,
  isCsvFile,
  toggleApproval,
  toggleFriend,
  type Decisions,
} from "@/lib/attendeeMatch";
import type {
  AttendeeApplyResult,
  AttendeeFriendResult,
  AttendeeMatchPreview,
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
        Match attendees to alumni: {eventName}
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
 * Review a conference attendee list against the alumni database and approve
 * matches one at a time (#612, #537).
 *
 * Rows are matched on Net ID first: an exact hit is `auto_confirmed` by the
 * backend and rendered here as settled (no checkbox), then sent through the
 * same approve call carrying its `net_id` for the server to re-verify. Every
 * email or name match is a PROPOSAL: nothing is pre-selected, there is no
 * "select all" and no approve-above-a-confidence shortcut, and an ambiguous
 * row (including a Net ID that points at one record while the email or name
 * points at another) shows every candidate rather than silently picking the
 * top-scoring one. Text-only controls per the app's no-icons preference.
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

  // `mx-auto max-w-5xl` is the same wrapper every other import wizard uses
  // (EventsImportWizard, ImportWizard, UpdateImportWizard,
  // DonationsImportWizard). This one had the max width without the auto
  // margins, so above ~1024px it hugged the left edge of the page (#829).
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <StepHeader step={step} eventName={eventName} />

      {step === "upload" ? (
        <Card className="space-y-4 p-6">
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Upload the conference registration list. Attendees are matched on
              their <strong>Net ID</strong> first: a row whose Net ID is on
              file is confirmed on the spot and needs no review. Rows without
              a Net ID, or whose Net ID isn&apos;t on file, are matched on
              their <strong>email</strong>, then on their <strong>name</strong>{" "}
              with the company as supporting evidence.
            </p>
            <p>
              Column names don&apos;t have to match anything: Net ID, Email,
              E-mail Address, Company, Employer, Organization, Job Title and a
              combined Name column are all understood, and columns we
              don&apos;t recognise are simply ignored. The example CSV below
              has a Net ID column.
            </p>
            <p>
              Every email or name match is a <strong>proposal</strong>. Nothing
              is recorded until you approve it on the next screen; only Net ID
              matches go through without approval.
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            <SummaryCard label="Rows in file" value={preview.summary.total_rows} />
            <SummaryCard
              label="Matched by Net ID"
              value={preview.summary.auto_confirmed}
            />
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
            Rows matched by Net ID are already confirmed and need nothing from
            you. Everything else is a proposal: nothing is selected for you, and
            there is no “approve everything” button on purpose, because a wrong
            match silently credits the wrong person. Tick the record you are
            confident about, or tick “create a friend record” for someone who
            isn&apos;t in the database.
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
              {counts.autoConfirmed > 0
                ? `${counts.autoConfirmed} matched by Net ID, will be added without review · `
                : ""}
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
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
            {/* #538: an existing friend linked instead of a twin created, and
                rows whose email turned out to belong to a real alumnus. */}
            <SummaryCard
              label="Friends linked"
              value={friendResult?.reused ?? 0}
            />
            <SummaryCard
              label="Already alumni"
              value={friendResult?.existing_alumni ?? 0}
              tone="warning"
            />
            <SummaryCard
              label="Already on roster"
              value={friendResult?.skipped ?? 0}
              tone="muted"
            />
            <SummaryCard
              label="Not saved"
              value={
                (applyResult?.not_found ?? 0) +
                (applyResult?.net_id_mismatch ?? 0) +
                (friendResult?.rejected ?? 0)
              }
              tone="warning"
            />
          </div>

          {applyResult && applyResult.net_id_mismatch > 0 ? (
            <p className="rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700">
              {applyResult.net_id_mismatch} row
              {applyResult.net_id_mismatch === 1 ? " was" : "s were"} refused
              because the Net ID on file no longer matched. Re-run the check.
            </p>
          ) : null}
          {friendResult && friendResult.existing_alumni > 0 ? (
            <p className="rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700">
              {friendResult.existing_alumni} row
              {friendResult.existing_alumni === 1 ? "" : "s"} belong
              {friendResult.existing_alumni === 1 ? "s" : ""} to an alumnus by
              email, so no friend record was created. Upload the list again and
              match {friendResult.existing_alumni === 1 ? "them" : "those rows"}{" "}
              instead.
            </p>
          ) : null}

          {applyResult && applyResult.items.length > 0 ? (
            <ApplyOutcomes items={applyResult.items} />
          ) : null}

          {friendResult && friendResult.items.length > 0 ? (
            <FriendOutcomes items={friendResult.items} />
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
