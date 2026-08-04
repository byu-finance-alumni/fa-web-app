"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  previewEventAttendeeImport,
  commitEventAttendeeImport,
  downloadEventsTemplate,
} from "@/app/(app)/events/actions";
import type {
  EventAttendeeImportPreview,
  EventAttendeeImportResult,
} from "@/types/events-import";

/**
 * Upload an attendee CSV onto an event that ALREADY EXISTS (#611).
 *
 * The events import wizard goes the other way — one CSV creates one event — and
 * refuses a title/date that already exists. This is the half staff actually
 * asked for: create the event on its own with no roster, then bring the
 * attendee list later. Same CSV shape, same template; the event is addressed by
 * id and is never created, replaced, or edited — only attendance rows are
 * ADDED. Anyone already on the roster is skipped server-side, so re-uploading
 * the same file is safe.
 *
 * Check-then-import mirrors the wizard: a dry run reports who would be added,
 * who is already attending, and whose Net ID matched nobody, before anything is
 * written. Text-only controls per the app's no-icons preference.
 */

// Matches the backend's read cap (4 MiB), which sits deliberately below
// Vercel's ~4.5 MB serverless request-body ceiling. Rejecting oversize files
// here means the user gets this sentence instead of the browser's misleading
// "CORS error" when the platform drops the request before it reaches any code.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const isCsv = (file: File) =>
  file.name.toLowerCase().endsWith(".csv") ||
  file.type === "text/csv" ||
  file.type === "application/vnd.ms-excel";

function fileFormData(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file, file.name);
  return fd;
}

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

export function AttendeeCsvImport({
  eventId,
  className,
}: {
  eventId: number;
  className?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [preview, setPreview] = useState<EventAttendeeImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  const [result, setResult] = useState<EventAttendeeImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, startImporting] = useTransition();

  const [templateError, setTemplateError] = useState<string | null>(null);
  const [downloadingTemplate, startTemplate] = useTransition();

  function pickFile(next: File | null) {
    setPreview(null);
    setPreviewError(null);
    setResult(null);
    setImportError(null);
    if (!next) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (!isCsv(next)) {
      setFile(null);
      setFileError("That isn't a .csv file. Choose a CSV export.");
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setFileError(
        "That file is over the 4 MB upload limit. Split it into smaller batches.",
      );
      return;
    }
    setFileError(null);
    setFile(next);
  }

  function onCheck() {
    if (!file) return;
    setPreviewError(null);
    startChecking(async () => {
      const res = await previewEventAttendeeImport(eventId, fileFormData(file));
      if (res.ok) setPreview(res.data);
      else setPreviewError(res.error);
    });
  }

  function onImport() {
    if (!file) return;
    setImportError(null);
    startImporting(async () => {
      const res = await commitEventAttendeeImport(eventId, fileFormData(file));
      if (res.ok) {
        setResult(res.data);
        setPreview(null);
        setFile(null);
      } else {
        setImportError(res.error);
      }
    });
  }

  function onTemplate() {
    setTemplateError(null);
    startTemplate(async () => {
      const res = await downloadEventsTemplate();
      if (res.ok) downloadCsv("event-attendees-template.csv", res.csv);
      else setTemplateError(res.error);
    });
  }

  const summary = preview?.summary;

  return (
    <Card className={className}>
      <CardContent className="pt-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Upload an attendee list (CSV)
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Adds the people in the file to <strong>this</strong> event — it
              never creates a second event. One row per person with{" "}
              <strong>Net ID</strong>, <strong>First name</strong>,{" "}
              <strong>Last name</strong> and an optional <strong>Notes</strong>{" "}
              column. Attendees are matched by Net ID; anyone already on the
              roster is skipped and unmatched Net IDs are reported, never
              invented.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onTemplate}
              disabled={downloadingTemplate}
            >
              {downloadingTemplate ? "Downloading…" : "Download template"}
            </Button>
            {templateError ? (
              <p className="mt-1 text-xs text-danger-600">{templateError}</p>
            ) : null}
          </div>
        </div>

        {result ? (
          <ImportResult result={result} onImportAnother={() => setResult(null)} />
        ) : (
          <>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) pickFile(dropped);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
                dragOver
                  ? "border-brand-blue-600 bg-brand-blue-50"
                  : "border-gray-300 bg-gray-50 hover:border-brand-blue-300 hover:bg-brand-blue-50/40"
              }`}
            >
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-sm font-medium text-gray-900">
                Drag the attendee CSV here, or click to choose a file
              </p>
              <p className="mt-1 text-xs text-gray-500">.csv files only</p>
            </label>

            {fileError ? (
              <p className="mt-3 text-sm text-danger-600">{fileError}</p>
            ) : null}

            {file ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="truncate text-sm font-medium text-gray-900">
                  {file.name}{" "}
                  <span className="text-xs font-normal text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => pickFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : null}

            {previewError ? (
              <p className="mt-3 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
                {previewError}
              </p>
            ) : null}

            {preview && !preview.columns_ok ? (
              <div className="mt-3 rounded-lg border border-danger-600/40 bg-danger-50 p-3">
                <p className="text-sm font-semibold text-danger-600">
                  The file&apos;s columns don&apos;t match the template
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-danger-600">
                  {preview.header_errors.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview && preview.columns_ok && summary ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold tabular-nums text-gray-900">
                    {summary.attendees_new}
                  </span>{" "}
                  to add
                  {summary.attendees_existing > 0
                    ? ` · ${summary.attendees_existing} already attending (skipped)`
                    : ""}
                  {summary.attendees_unmatched > 0
                    ? ` · ${summary.attendees_unmatched} unmatched (skipped)`
                    : ""}{" "}
                  <span className="text-gray-500">
                    from {summary.total_rows} row
                    {summary.total_rows === 1 ? "" : "s"}
                  </span>
                </p>
                {preview.warnings.length > 0 ? (
                  <ul className="list-inside list-disc space-y-0.5 rounded-lg border border-warning-600/30 bg-warning-50 p-2.5 text-xs text-warning-600">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                ) : null}
                <UnmatchedList
                  rows={preview.attendees
                    .filter((a) => !a.matched)
                    .map((a) => ({ row: a.row, net_id: a.net_id, name: a.name }))}
                />
              </div>
            ) : null}

            {importError ? (
              <p className="mt-3 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
                {importError}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onCheck}
                disabled={!file || checking || importing}
              >
                {checking ? "Checking…" : "Check file"}
              </Button>
              <Button
                type="button"
                onClick={onImport}
                disabled={!file || !preview?.importable || importing || checking}
              >
                {importing
                  ? "Adding…"
                  : summary && preview?.importable
                    ? `Add ${summary.attendees_new} attendee${
                        summary.attendees_new === 1 ? "" : "s"
                      }`
                    : "Add attendees"}
              </Button>
              {!preview && file ? (
                <span className="text-xs text-gray-400">
                  Check the file first — nothing is written until you confirm.
                </span>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UnmatchedList({
  rows,
}: {
  rows: { row: number; net_id: string; name: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-warning-600/30 bg-warning-50 p-3">
      <p className="text-sm font-semibold text-warning-600">
        {rows.length} row{rows.length === 1 ? "" : "s"} skipped — the Net ID
        didn&rsquo;t match an active alumnus
      </p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
        {rows.map((u) => (
          <li key={u.row} className="flex items-baseline gap-2 text-gray-700">
            <span className="tabular-nums text-gray-500">Row {u.row}</span>
            <span className="font-medium text-gray-900">
              {u.name || "(no name)"}
            </span>
            <span className="text-danger-600">— {u.net_id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImportResult({
  result,
  onImportAnother,
}: {
  result: EventAttendeeImportResult;
  onImportAnother: () => void;
}) {
  return (
    <div className="space-y-3">
      {result.imported ? (
        <p className="rounded-lg border border-success-600/30 bg-success-50 px-3 py-2.5 text-sm text-gray-900">
          Added <span className="font-semibold tabular-nums">{result.added}</span>{" "}
          attendee{result.added === 1 ? "" : "s"} to this event
          {result.skipped_existing > 0
            ? `; ${result.skipped_existing} were already attending`
            : ""}
          {result.unmatched.length > 0
            ? `; ${result.unmatched.length} row${
                result.unmatched.length === 1 ? "" : "s"
              } skipped`
            : ""}
          .
        </p>
      ) : (
        <p className="rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
          {result.error ?? "Nothing was added."}
        </p>
      )}

      <UnmatchedList rows={result.unmatched} />

      <div className="flex flex-wrap items-center gap-3">
        {/* The attendee list loads client-side on mount, so a reload is the
            honest way to show the rows this import just added. */}
        <Button type="button" onClick={() => window.location.reload()}>
          Refresh attendee list
        </Button>
        <Button type="button" variant="secondary" onClick={onImportAnother}>
          Upload another file
        </Button>
      </div>
    </div>
  );
}
