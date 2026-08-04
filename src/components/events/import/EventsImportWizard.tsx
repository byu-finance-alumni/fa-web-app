"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type {
  EventImportAttendee,
  EventImportPreview,
  EventImportResult,
} from "@/types/events-import";
import {
  previewEventsImport,
  commitEventsImport,
  downloadEventsTemplate,
} from "@/app/(app)/events/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Step = "upload" | "review" | "result";

interface EventFields {
  name: string;
  date: string;
  type: string;
  location: string;
  notes: string;
}

const EMPTY_FIELDS: EventFields = {
  name: "",
  date: "",
  type: "",
  location: "",
  notes: "",
};

function importForm(file: File, ev: EventFields): FormData {
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("event_name", ev.name.trim());
  if (ev.date) fd.append("event_date", ev.date);
  if (ev.type.trim()) fd.append("event_type", ev.type.trim());
  if (ev.location.trim()) fd.append("event_location", ev.location.trim());
  if (ev.notes.trim()) fd.append("event_notes", ev.notes.trim());
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

const isCsv = (file: File) =>
  file.name.toLowerCase().endsWith(".csv") ||
  file.type === "text/csv" ||
  file.type === "application/vnd.ms-excel";

/**
 * Bulk-import one event's attendees from a CSV (#149). The event's details are
 * entered here; the CSV is just the attendee roster (Net ID, First name, Last
 * name, Notes). Attendees
 * are matched to existing alumni by Net ID — unmatched ones are reported and
 * skipped, never invented. The backend re-enforces everything. Text-only
 * controls per the app's no-icons preference.
 */
export function EventsImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [fields, setFields] = useState<EventFields>(EMPTY_FIELDS);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [preview, setPreview] = useState<EventImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  const [result, setResult] = useState<EventImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, startImporting] = useTransition();

  const [templateError, setTemplateError] = useState<string | null>(null);
  const [downloadingTemplate, startTemplate] = useTransition();

  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setField = (key: keyof EventFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const pickFile = (next: File | null) => {
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
    setFileError(null);
    setFile(next);
  };

  const canCheck = !!file && fields.name.trim().length > 0;

  const onCheck = () => {
    if (!file || !canCheck) return;
    setPreviewError(null);
    startChecking(async () => {
      const res = await previewEventsImport(importForm(file, fields));
      if (res.ok) {
        setPreview(res.data);
        setStep("review");
      } else {
        setPreviewError(res.error);
      }
    });
  };

  const onImport = () => {
    if (!file) return;
    setImportError(null);
    startImporting(async () => {
      const res = await commitEventsImport(importForm(file, fields));
      if (res.ok) {
        setResult(res.data);
        setStep("result");
      } else {
        setImportError(res.error);
      }
    });
  };

  const onTemplate = () => {
    setTemplateError(null);
    startTemplate(async () => {
      const res = await downloadEventsTemplate();
      if (res.ok) downloadCsv("event-attendees-template.csv", res.csv);
      else setTemplateError(res.error);
    });
  };

  const reset = () => {
    pickFile(null);
    setFields(EMPTY_FIELDS);
    setStep("upload");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <StepHeader step={step} />

      {step === "upload" && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Import one event&rsquo;s attendees
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter the event&rsquo;s details, then upload a CSV of its
                  attendees — one row per person with{" "}
                  <strong>Net ID</strong>, <strong>First name</strong>,{" "}
                  <strong>Last name</strong>, and an optional <strong>Notes</strong>{" "}
                  column. Attendees are matched to existing alumni by Net ID;
                  unmatched ones are reported and skipped. Start from the template
                  so the columns line up.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onTemplate}
                  disabled={downloadingTemplate}
                >
                  {downloadingTemplate ? "Downloading…" : "Download template"}
                </Button>
                {templateError && (
                  <p className="mt-1 text-xs text-danger-600">{templateError}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="event_name">Event title *</Label>
                <Input
                  id="event_name"
                  value={fields.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Spring Finance Banquet"
                  className="mt-1"
                  maxLength={255}
                />
              </div>
              <div>
                <Label htmlFor="event_date">Date</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={fields.date}
                  onChange={(e) => setField("date", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="event_type">Type</Label>
                <Input
                  id="event_type"
                  value={fields.type}
                  onChange={(e) => setField("type", e.target.value)}
                  placeholder="Networking"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="event_location">Location</Label>
                <Input
                  id="event_location"
                  value={fields.location}
                  onChange={(e) => setField("location", e.target.value)}
                  placeholder="Tanner Building"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="event_notes">Notes</Label>
                <Textarea
                  id="event_notes"
                  value={fields.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
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
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) pickFile(dropped);
              }}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
                dragOver
                  ? "border-brand-blue-600 bg-brand-blue-50"
                  : "border-gray-300 bg-gray-50 hover:border-brand-blue-300 hover:bg-brand-blue-50/40"
              }`}
            >
              <input
                ref={inputRef}
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

            {fileError && (
              <p className="mt-3 text-sm text-danger-600">{fileError}</p>
            )}

            {file && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="truncate text-sm font-medium text-gray-900">
                  {file.name}{" "}
                  <span className="text-xs font-normal text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => pickFile(null)}
                >
                  Remove
                </Button>
              </div>
            )}

            {previewError && (
              <p className="mt-4 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
                {previewError}
              </p>
            )}
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button asChild variant="secondary">
              <Link href="/events">Cancel</Link>
            </Button>
            <Button
              variant="primary"
              onClick={onCheck}
              disabled={!canCheck || checking}
            >
              {checking ? "Checking…" : "Check file"}
            </Button>
          </div>
          {!canCheck && (file || fields.name) && (
            <p className="text-right text-xs text-gray-400">
              An event title and an attendee CSV are both required.
            </p>
          )}
        </div>
      )}

      {step === "review" && preview && (
        <ReviewStep
          preview={preview}
          importing={importing}
          importError={importError}
          onBack={() => setStep("upload")}
          onImport={onImport}
        />
      )}

      {step === "result" && result && (
        <ResultStep result={result} onImportAnother={reset} />
      )}
    </div>
  );
}

function StepHeader({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Details & CSV" },
    { id: "review", label: "Review" },
    { id: "result", label: "Done" },
  ];
  const activeIndex = steps.findIndex((s) => s.id === step);
  return (
    <ol className="mb-6 flex items-center gap-3 text-sm">
      {steps.map((s, i) => {
        const active = i === activeIndex;
        const done = i < activeIndex;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-brand-blue-600 text-white"
                  : done
                    ? "bg-success-600 text-white"
                    : "border border-gray-300 bg-white text-gray-400"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`font-medium ${active ? "text-gray-900" : "text-gray-400"}`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="ml-1 h-0.5 w-8 rounded-full bg-gray-200" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-success-600"
      : tone === "danger"
        ? "text-danger-600"
        : tone === "warning"
          ? "text-warning-600"
          : "text-gray-900";
  return (
    <Card className="p-4">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </Card>
  );
}

function ReviewStep({
  preview,
  importing,
  importError,
  onBack,
  onImport,
}: {
  preview: EventImportPreview;
  importing: boolean;
  importError: string | null;
  onBack: () => void;
  onImport: () => void;
}) {
  const { summary, columns_ok, header_errors, event, attendees, warnings } =
    preview;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900">
          {event.event_name || "(untitled event)"}
          {event.event_date ? (
            <span className="ml-2 font-normal text-gray-500">
              {event.event_date}
            </span>
          ) : (
            <span className="ml-2 font-normal text-gray-400">(no date)</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {[event.event_type, event.event_location]
            .filter(Boolean)
            .join(" · ") || "No type or location"}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard label="Attendee rows" value={summary.total_rows} />
        <SummaryCard
          label="Matched"
          value={summary.attendees_matched}
          tone="success"
        />
        <SummaryCard
          label="Unmatched (skipped)"
          value={summary.attendees_unmatched}
          tone={summary.attendees_unmatched > 0 ? "warning" : undefined}
        />
      </div>

      {!columns_ok && (
        <div className="rounded-lg border border-danger-600/40 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-600">
            The file&apos;s columns don&apos;t match the template
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-danger-600">
            {header_errors.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {preview.event_errors.length > 0 && (
        <div className="rounded-lg border border-danger-600/40 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-600">
            This event can&apos;t be imported
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-danger-600">
            {preview.event_errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="list-inside list-disc space-y-0.5 rounded-lg border border-warning-600/30 bg-warning-50 p-3 text-xs text-warning-600">
          {warnings.map((w, i) => (
            <li key={i}>{w.message}</li>
          ))}
        </ul>
      )}

      {columns_ok && attendees.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Attendees ({attendees.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {attendees.map((a) => (
              <AttendeeChip key={a.row} a={a} />
            ))}
          </div>
        </Card>
      )}

      {importError && (
        <p className="rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
          {importError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onImport}
          disabled={!preview.importable || importing}
        >
          {importing
            ? "Importing…"
            : `Create event with ${summary.attendees_matched} attendee${
                summary.attendees_matched === 1 ? "" : "s"
              }`}
        </Button>
      </div>
    </div>
  );
}

function AttendeeChip({ a }: { a: EventImportAttendee }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs ${
        a.matched
          ? "bg-gray-100 text-gray-700"
          : "bg-danger-50 text-danger-600 line-through"
      }`}
      title={
        (a.matched
          ? `Matched alumni #${a.alumni_id}`
          : "No active alumnus for this Net ID — will be skipped") +
        (a.notes ? ` · Notes: ${a.notes}` : "")
      }
    >
      {a.name || a.net_id} ({a.net_id})
      {a.notes ? (
        <span className="ml-1 text-[10px] uppercase text-gray-400">note</span>
      ) : null}
    </span>
  );
}

function ResultStep({
  result,
  onImportAnother,
}: {
  result: EventImportResult;
  onImportAnother: () => void;
}) {
  const hasUnmatched = result.unmatched.length > 0;
  return (
    <div className="space-y-4">
      <Card className="p-6">
        {result.imported ? (
          <>
            <h2 className="text-lg font-semibold text-gray-900">
              Event created
            </h2>
            <p className="text-sm text-gray-500">
              Added the event with {result.imported_attendees} attendee
              {result.imported_attendees === 1 ? "" : "s"}
              {hasUnmatched
                ? `, ${result.unmatched.length} unmatched row${
                    result.unmatched.length === 1 ? "" : "s"
                  } skipped`
                : ""}
              .
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
              <SummaryCard
                label="Attendees added"
                value={result.imported_attendees}
                tone="success"
              />
              <SummaryCard
                label="Skipped"
                value={result.unmatched.length}
                tone={hasUnmatched ? "warning" : undefined}
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900">
              Nothing imported
            </h2>
            <p className="text-sm text-danger-600">
              {result.event_error ?? "The event could not be created."}
            </p>
          </>
        )}

        {hasUnmatched && (
          <div className="mt-5 rounded-lg border border-warning-600/30 bg-warning-50 p-4">
            <p className="text-sm font-semibold text-warning-600">
              {result.unmatched.length} attendee row
              {result.unmatched.length === 1 ? " was" : "s were"} skipped (Net ID
              didn&rsquo;t match an active alumnus)
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
              {result.unmatched.map((u) => (
                <li
                  key={u.row}
                  className="flex items-baseline gap-2 text-gray-700"
                >
                  <span className="tabular-nums text-gray-500">Row {u.row}</span>
                  <span className="font-medium text-gray-900">
                    {u.name || "(no name)"}
                  </span>
                  <span className="text-danger-600">— {u.net_id}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onImportAnother}>
          Import another event
        </Button>
        <Button asChild variant="primary">
          <Link href="/events">Go to events</Link>
        </Button>
      </div>
    </div>
  );
}
