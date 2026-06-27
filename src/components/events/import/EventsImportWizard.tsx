"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type {
  EventImportGroup,
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

type Step = "upload" | "review" | "result";

function fileForm(file: File): FormData {
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

const isCsv = (file: File) =>
  file.name.toLowerCase().endsWith(".csv") ||
  file.type === "text/csv" ||
  file.type === "application/vnd.ms-excel";

/**
 * Bulk-import events from a CSV. One row per attendee; rows sharing a title +
 * date form one event. Attendees are matched to existing alumni by Net ID, and
 * any unmatched Net ID (or bad date / missing title / duplicate event) rejects
 * that whole event group — the backend re-enforces all of this. Text-only
 * controls per the app's no-icons preference.
 */
export function EventsImportWizard() {
  const [step, setStep] = useState<Step>("upload");
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

  const onCheck = () => {
    if (!file) return;
    setPreviewError(null);
    startChecking(async () => {
      const res = await previewEventsImport(fileForm(file));
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
      const res = await commitEventsImport(fileForm(file));
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
      if (res.ok) downloadCsv("events-import-template.csv", res.csv);
      else setTemplateError(res.error);
    });
  };

  const onDownloadRejects = () => {
    if (!result || result.rejects.length === 0) return;
    // Strip leading formula characters before quoting (CSV injection defence).
    const esc = (v: string) =>
      `"${String(v).replace(/^[=+\-@\t\r]+/, "").replace(/"/g, '""')}"`;
    const lines = [
      "event,date,reason",
      ...result.rejects.map((r) =>
        [esc(r.event), esc(r.date ?? ""), esc(r.reason)].join(","),
      ),
    ];
    downloadCsv("events-import-rejects.csv", lines.join("\r\n"));
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
                  Upload an events CSV
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Bulk-add events and their attendees from a spreadsheet. Use one
                  row per attendee — rows that share an event title and date
                  become one event. Attendees are matched to existing alumni by
                  Net ID. Start from the template so the columns line up.
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
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition ${
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
                Drag a CSV here, or click to choose a file
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
            <Button variant="primary" onClick={onCheck} disabled={!file || checking}>
              {checking ? "Checking…" : "Check file"}
            </Button>
          </div>
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
        <ResultStep
          result={result}
          onDownloadRejects={onDownloadRejects}
          onImportAnother={() => {
            pickFile(null);
            setStep("upload");
          }}
        />
      )}
    </div>
  );
}

function StepHeader({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
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
  const { summary, columns_ok, header_errors, events } = preview;
  const canImport = columns_ok && summary.importable_events > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Events" value={summary.events} />
        <SummaryCard
          label="Importable"
          value={summary.importable_events}
          tone="success"
        />
        <SummaryCard
          label="Rejected"
          value={summary.rejected_events}
          tone={summary.rejected_events > 0 ? "danger" : undefined}
        />
        <SummaryCard label="Attendees matched" value={summary.attendees_matched} />
        <SummaryCard
          label="Net IDs unmatched"
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

      {columns_ok && (
        <div className="space-y-2">
          {events.map((ev, i) => (
            <EventRow key={i} ev={ev} />
          ))}
        </div>
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
        <Button variant="primary" onClick={onImport} disabled={!canImport || importing}>
          {importing
            ? "Importing…"
            : `Import ${summary.importable_events} event${
                summary.importable_events === 1 ? "" : "s"
              }`}
        </Button>
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: EventImportGroup }) {
  const rejected = ev.status === "rejected";
  return (
    <Card className={`p-4 ${rejected ? "border-danger-600/30 bg-danger-50/40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {ev.event_title}
            {ev.event_date ? (
              <span className="ml-2 font-normal text-gray-500">
                {ev.event_date}
              </span>
            ) : (
              <span className="ml-2 font-normal text-gray-400">(no date)</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {ev.attendee_count} attendee{ev.attendee_count === 1 ? "" : "s"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            rejected
              ? "bg-danger-50 text-danger-600"
              : "bg-success-50 text-success-600"
          }`}
        >
          {rejected ? "Rejected" : "Importable"}
        </span>
      </div>

      {ev.blockers.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-danger-600">
          {ev.blockers.map((b, i) => (
            <li key={i}>{b.message}</li>
          ))}
        </ul>
      )}
      {ev.warnings.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-warning-600">
          {ev.warnings.map((w, i) => (
            <li key={i}>{w.message}</li>
          ))}
        </ul>
      )}

      {ev.attendees.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ev.attendees.map((a, i) => (
            <span
              key={i}
              className={`rounded px-1.5 py-0.5 text-xs ${
                a.matched
                  ? "bg-gray-100 text-gray-700"
                  : "bg-danger-50 text-danger-600 line-through"
              }`}
              title={a.matched ? `Matched alumni #${a.alumni_id}` : "No active alumnus for this Net ID"}
            >
              {a.name || a.net_id} ({a.net_id})
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function ResultStep({
  result,
  onDownloadRejects,
  onImportAnother,
}: {
  result: EventImportResult;
  onDownloadRejects: () => void;
  onImportAnother: () => void;
}) {
  const hasRejects = result.rejects.length > 0;
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">Import complete</h2>
        <p className="text-sm text-gray-500">
          {result.imported_events} event
          {result.imported_events === 1 ? "" : "s"} added with{" "}
          {result.imported_attendees} attendee
          {result.imported_attendees === 1 ? "" : "s"}
          {result.skipped_events > 0
            ? `, ${result.skipped_events} skipped`
            : ""}
          .
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-lg">
          <SummaryCard
            label="Events"
            value={result.imported_events}
            tone="success"
          />
          <SummaryCard label="Attendees" value={result.imported_attendees} />
          <SummaryCard
            label="Skipped"
            value={result.skipped_events}
            tone={result.skipped_events > 0 ? "danger" : undefined}
          />
        </div>

        {hasRejects && (
          <div className="mt-5 rounded-lg border border-warning-600/30 bg-warning-50 p-4">
            <p className="text-sm font-semibold text-warning-600">
              {result.rejects.length} event
              {result.rejects.length === 1 ? " was" : "s were"} skipped
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
              {result.rejects.map((r, i) => (
                <li key={i} className="flex items-baseline gap-2 text-gray-700">
                  <span className="font-medium text-gray-900">{r.event}</span>
                  {r.date && <span className="text-gray-500">{r.date}</span>}
                  <span className="text-danger-600">— {r.reason}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              onClick={onDownloadRejects}
              className="mt-4"
            >
              Download skipped (CSV)
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onImportAnother}>
          Import another file
        </Button>
        <Button asChild variant="primary">
          <Link href="/events">Go to events</Link>
        </Button>
      </div>
    </div>
  );
}
