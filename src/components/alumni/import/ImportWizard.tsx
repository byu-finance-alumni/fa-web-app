"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import type { ImportPreview, ImportResult } from "@/types/alumni";
import {
  previewImport,
  commitImport,
  downloadImportTemplate,
  type ImportKind,
} from "@/app/(app)/alumni/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadCsvFile } from "@/lib/csv";
import {
  FAILED_ROWS_UNAVAILABLE,
  FAILED_ROWS_UNREADABLE,
  REASON_COLUMN_NOTE,
  REASON_COLUMN_NOTE_PREVIEW,
  buildFailedRowsCsv,
  previewRejects,
  unmatchedNote,
} from "@/lib/importFailures";
import type { ImportRejectLike } from "@/lib/importFailures";
import { ImportReviewTable } from "./ImportReviewTable";

type Step = "upload" | "review" | "result";

/** Build a FormData carrying the single file under the `file` key. */
function fileForm(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file, file.name);
  return fd;
}

const isCsv = (file: File) =>
  file.name.toLowerCase().endsWith(".csv") ||
  file.type === "text/csv" ||
  file.type === "application/vnd.ms-excel";

/**
 * Copy/routing that differs by roster. `kind` also flows through to the three
 * import server actions (`?kind=…`) so the backend picks the right template and
 * stamps `is_alumni` correctly. Defaults to `alumni` so the alumni import is
 * byte-for-byte unchanged.
 */
export function ImportWizard({ kind = "alumni" }: { kind?: ImportKind }) {
  const isFriend = kind === "friend";
  const noun = isFriend ? "friends" : "alumni";
  const listPath = isFriend ? "/friends" : "/alumni";
  const listLabel = isFriend ? "Friends" : "Alumni";

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, startImporting] = useTransition();

  const [templateError, setTemplateError] = useState<string | null>(null);
  const [downloadingTemplate, startTemplate] = useTransition();

  const [failedRowsError, setFailedRowsError] = useState<string | null>(null);
  const [failedRowsNote, setFailedRowsNote] = useState<string | null>(null);
  const [buildingFailedRows, setBuildingFailedRows] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * The rows the preview says will NOT import, in reject shape (#693).
   *
   * The preview reports a status per row rather than a list of rejects, so the
   * adapter in `importFailures` decides which rows those are — one place, and
   * one that a test pins, rather than a `status === "rejected"` guess inline.
   */
  const previewSkips = useMemo<ImportRejectLike[]>(
    () => (preview ? previewRejects(preview.rows) : []),
    [preview],
  );

  /** Clear any note/error left over from the other step's download. */
  const clearFailedRowsFeedback = () => {
    setFailedRowsError(null);
    setFailedRowsNote(null);
  };

  const pickFile = (next: File | null) => {
    setPreview(null);
    setPreviewError(null);
    setResult(null);
    setImportError(null);
    setFailedRowsError(null);
    setFailedRowsNote(null);
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
    clearFailedRowsFeedback();
    startChecking(async () => {
      const res = await previewImport(fileForm(file), kind);
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
    clearFailedRowsFeedback();
    startImporting(async () => {
      const res = await commitImport(fileForm(file), kind);
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
      const res = await downloadImportTemplate(kind);
      if (res.ok) {
        downloadCsvFile(`${noun}-import-template.csv`, res.csv);
      } else {
        setTemplateError(res.error);
      }
    });
  };

  /**
   * Download ONLY the rows that will not import, in the shape they arrived in
   * (#693).
   *
   * Built from `file` — the CSV still sitting in this component's state — not
   * from the API, because neither the reject list nor the preview report
   * carries the row's values. `file` survives both steps: `pickFile(null)` only
   * runs when the operator starts another import.
   *
   * Shared by the review and result steps so the two downloads can never drift
   * in format; only the rejects and the file name differ.
   */
  const downloadFailedRows = async (
    rejects: readonly ImportRejectLike[],
    filename: string,
  ) => {
    if (rejects.length === 0 || !file) return;
    setFailedRowsError(null);
    setFailedRowsNote(null);
    setBuildingFailedRows(true);
    try {
      const built = buildFailedRowsCsv(await file.text(), rejects);
      if (!built.csv) {
        setFailedRowsError(FAILED_ROWS_UNAVAILABLE);
        return;
      }
      setFailedRowsNote(unmatchedNote(built));
      downloadCsvFile(filename, built.csv);
    } catch {
      // Deliberately generic: whatever the File API threw is of no use to the
      // operator and must not reach the screen.
      setFailedRowsError(FAILED_ROWS_UNREADABLE);
    } finally {
      setBuildingFailedRows(false);
    }
  };

  /**
   * The same download at the REVIEW step — before anything has been imported,
   * which is where the operator actually finds out these rows are a problem.
   */
  const onDownloadPreviewFailedRows = () => {
    void downloadFailedRows(previewSkips, `${noun}-import-rows-to-fix.csv`);
  };

  const onDownloadFailedRows = () => {
    if (!result) return;
    void downloadFailedRows(
      result.rejects,
      `${noun}-import-failed-rows.csv`,
    );
  };

  const resetToUpload = () => {
    setStep("upload");
    setPreview(null);
    setPreviewError(null);
    clearFailedRowsFeedback();
  };

  return (
    <div className="mx-auto max-w-5xl">
      <StepHeader step={step} />

      {step === "upload" && (
        <UploadStep
          noun={noun}
          listPath={listPath}
          file={file}
          fileError={fileError}
          dragOver={dragOver}
          checking={checking}
          previewError={previewError}
          downloadingTemplate={downloadingTemplate}
          templateError={templateError}
          inputRef={inputRef}
          setDragOver={setDragOver}
          onPick={pickFile}
          onCheck={onCheck}
          onTemplate={onTemplate}
        />
      )}

      {step === "review" && preview && (
        <ReviewStep
          preview={preview}
          importing={importing}
          importError={importError}
          skipCount={previewSkips.length}
          canDownloadFailedRows={file !== null}
          buildingFailedRows={buildingFailedRows}
          failedRowsError={failedRowsError}
          failedRowsNote={failedRowsNote}
          onDownloadFailedRows={onDownloadPreviewFailedRows}
          onBack={resetToUpload}
          onImport={onImport}
        />
      )}

      {step === "result" && result && (
        <ResultStep
          noun={noun}
          listPath={listPath}
          listLabel={listLabel}
          result={result}
          canDownloadFailedRows={file !== null}
          buildingFailedRows={buildingFailedRows}
          failedRowsError={failedRowsError}
          failedRowsNote={failedRowsNote}
          onDownloadFailedRows={onDownloadFailedRows}
          onImportAnother={() => {
            pickFile(null);
            setStep("upload");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- step header --- */

function StepHeader({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "review", label: "Review" },
    { id: "result", label: "Done" },
  ];
  const activeIndex = steps.findIndex((s) => s.id === step);
  return (
    <ol
      className="mb-6 flex items-center text-sm"
      aria-label={`Import step ${activeIndex + 1} of ${steps.length}: ${
        steps[activeIndex]?.label ?? ""
      }`}
    >
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li
            key={s.id}
            className={i < steps.length - 1 ? "flex flex-1 items-center" : "flex items-center"}
          >
            <span className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? "bg-brand-blue-600 text-white ring-2 ring-brand-blue-100"
                    : done
                      ? "bg-success-600 text-white"
                      : "border border-gray-300 bg-white text-gray-400"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`font-medium ${
                  active
                    ? "text-gray-900"
                    : done
                      ? "text-gray-700"
                      : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </span>
            {i < steps.length - 1 && (
              <span
                className={`mx-3 h-0.5 flex-1 rounded-full ${
                  done ? "bg-success-600" : "bg-gray-200"
                }`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------------------------------------------- step 1: upload --- */

function UploadStep({
  noun,
  listPath,
  file,
  fileError,
  dragOver,
  checking,
  previewError,
  downloadingTemplate,
  templateError,
  inputRef,
  setDragOver,
  onPick,
  onCheck,
  onTemplate,
}: {
  noun: string;
  listPath: string;
  file: File | null;
  fileError: string | null;
  dragOver: boolean;
  checking: boolean;
  previewError: string | null;
  downloadingTemplate: boolean;
  templateError: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setDragOver: (v: boolean) => void;
  onPick: (f: File | null) => void;
  onCheck: () => void;
  onTemplate: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Upload a CSV
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Bulk-add or update {noun} from a spreadsheet. Start from the
              template so the columns line up, then check the file before
              importing.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <Button
              variant="secondary"
              size="sm"
              onClick={onTemplate}
              disabled={downloadingTemplate}
            >
              {downloadingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download template
            </Button>
            {templateError && (
              <p className="mt-1 text-xs text-danger-600">{templateError}</p>
            )}
          </div>
        </div>

        {/* Drag-and-drop zone */}
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
            if (dropped) onPick(dropped);
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
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          <Upload className="mb-3 h-8 w-8 text-gray-500" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-900">
            Drag a CSV here, or click to choose a file
          </p>
          <p className="mt-1 text-xs text-gray-500">.csv files only</p>
        </label>

        {fileError && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-danger-600">
            <AlertTriangle className="h-4 w-4" /> {fileError}
          </p>
        )}

        {file && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-gray-500" />
              <span className="truncate text-sm font-medium text-gray-900">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPick(null)}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {previewError && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-sm text-danger-600">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {previewError}
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={onCheck}
              className="shrink-0 px-0 text-danger-600 hover:text-danger-600"
            >
              Retry
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button asChild variant="secondary">
          <Link href={listPath}>Cancel</Link>
        </Button>
        <Button
          variant="primary"
          onClick={onCheck}
          disabled={!file || checking}
        >
          {checking && <Loader2 className="h-4 w-4 animate-spin" />}
          {checking ? "Checking…" : "Check file"}
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- step 2: review --- */

function ReviewStep({
  preview,
  importing,
  importError,
  skipCount,
  canDownloadFailedRows,
  buildingFailedRows,
  failedRowsError,
  failedRowsNote,
  onDownloadFailedRows,
  onBack,
  onImport,
}: {
  preview: ImportPreview;
  importing: boolean;
  importError: string | null;
  skipCount: number;
  canDownloadFailedRows: boolean;
  buildingFailedRows: boolean;
  failedRowsError: string | null;
  failedRowsNote: string | null;
  onDownloadFailedRows: () => void;
  onBack: () => void;
  onImport: () => void;
}) {
  const { summary, columns_ok, header_errors, rows } = preview;
  const canImport = columns_ok && summary.importable > 0;
  const plural = skipCount === 1 ? "" : "s";

  return (
    <div className="space-y-4">
      {/* Summary cards stay pinned above the scrolling table */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Total rows" value={summary.total} />
        <SummaryCard
          label="Importable"
          value={summary.importable}
          tone="success"
        />
        <SummaryCard
          label="Rejected"
          value={summary.rejected}
          tone={summary.rejected > 0 ? "danger" : undefined}
        />
        <SummaryCard
          label="With warnings"
          value={summary.with_warnings}
          tone={summary.with_warnings > 0 ? "warning" : undefined}
        />
        <SummaryCard label="Auto-cleaned" value={summary.cleaned} />
      </div>

      {!columns_ok && (
        <div className="rounded-lg border border-danger-600/40 bg-danger-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger-600">
            <AlertTriangle className="h-5 w-5" /> The file&apos;s columns
            don&apos;t match the template
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-1 text-sm text-danger-600">
            {header_errors.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-gray-700">
            Fix the header row (download the template for the exact columns) and
            re-upload — no rows can be imported until the columns match.
          </p>
        </div>
      )}

      {columns_ok && (
        <ImportReviewTable rows={rows} />
      )}

      {/*
        The same "just the broken ones" download as the result step, offered
        BEFORE the import runs (#693). This is where the operator first learns
        which rows are a problem, so the copy is future tense throughout: these
        rows WILL be skipped, they have not been.
      */}
      {columns_ok && skipCount > 0 && (
        <div className="rounded-lg border border-warning-600/30 bg-warning-50 p-4">
          <p className="text-sm font-semibold text-warning-600">
            {skipCount} row{plural} will be skipped if you import now
          </p>
          <p className="mt-1 text-sm text-gray-700">
            Nothing has been imported yet. Download just these rows, fix them,
            and upload that file — or import the {summary.importable} good row
            {summary.importable === 1 ? "" : "s"} now and come back to the rest.
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={onDownloadFailedRows}
              disabled={!canDownloadFailedRows || buildingFailedRows}
            >
              {buildingFailedRows
                ? "Preparing…"
                : `Download the ${skipCount} row${plural} that will be skipped (CSV)`}
            </Button>
            <p className="mt-2 max-w-2xl text-xs text-gray-600">
              {canDownloadFailedRows
                ? REASON_COLUMN_NOTE_PREVIEW
                : "The uploaded file is no longer in this page, so those rows can't be rebuilt. The reasons in the table above list every one."}
            </p>
            {failedRowsNote && (
              <p className="mt-1 max-w-2xl text-xs text-gray-700">
                {failedRowsNote}
              </p>
            )}
            {failedRowsError && (
              <p className="mt-1 max-w-2xl text-xs text-danger-600">
                {failedRowsError}
              </p>
            )}
          </div>
        </div>
      )}

      {importError && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-sm text-danger-600">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {importError}
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={onImport}
            className="shrink-0 px-0 text-danger-600 hover:text-danger-600"
          >
            Retry
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          variant="primary"
          onClick={onImport}
          disabled={!canImport || importing}
        >
          {importing && <Loader2 className="h-4 w-4 animate-spin" />}
          {importing
            ? "Importing…"
            : `Import ${summary.importable} row${
                summary.importable === 1 ? "" : "s"
              }`}
        </Button>
      </div>
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
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${valueClass}`}
      >
        {value}
      </p>
    </Card>
  );
}

/* ----------------------------------------------------------- step 3: result --- */

function ResultStep({
  noun,
  listPath,
  listLabel,
  result,
  canDownloadFailedRows,
  buildingFailedRows,
  failedRowsError,
  failedRowsNote,
  onDownloadFailedRows,
  onImportAnother,
}: {
  noun: string;
  listPath: string;
  listLabel: string;
  result: ImportResult;
  canDownloadFailedRows: boolean;
  buildingFailedRows: boolean;
  failedRowsError: string | null;
  failedRowsNote: string | null;
  onDownloadFailedRows: () => void;
  onImportAnother: () => void;
}) {
  const hasRejects = result.rejects.length > 0;
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-50">
            <CheckCircle2 className="h-6 w-6 text-success-600" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Import complete
            </h2>
            <p className="text-sm text-gray-500">
              {result.imported} {noun} added
              {result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
          <SummaryCard
            label="Imported"
            value={result.imported}
            tone="success"
          />
          <SummaryCard
            label="Skipped"
            value={result.skipped}
            tone={result.skipped > 0 ? "danger" : undefined}
          />
        </div>

        {hasRejects && (
          <div className="mt-5 rounded-lg border border-warning-600/30 bg-warning-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-warning-600">
              <AlertTriangle className="h-5 w-5" />
              {result.rejects.length} row
              {result.rejects.length === 1 ? " was" : "s were"} skipped
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Download just these rows, fix them, and upload that file.
              {result.imported > 0
                ? ` The ${result.imported} row${
                    result.imported === 1 ? "" : "s"
                  } that already imported stay untouched.`
                : ""}
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
              {result.rejects.map((r) => (
                <li
                  key={r.row}
                  className="flex items-baseline gap-2 text-gray-700"
                >
                  <span className="shrink-0 tabular-nums text-gray-500">
                    Row {r.row}
                  </span>
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <span className="text-danger-600">— {r.reason}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={onDownloadFailedRows}
                disabled={!canDownloadFailedRows || buildingFailedRows}
              >
                {buildingFailedRows
                  ? "Preparing…"
                  : `Download the ${result.rejects.length} skipped row${
                      result.rejects.length === 1 ? "" : "s"
                    } (CSV)`}
              </Button>
              <p className="mt-2 max-w-2xl text-xs text-gray-600">
                {canDownloadFailedRows
                  ? REASON_COLUMN_NOTE
                  : "The uploaded file is no longer in this page, so the skipped rows can't be rebuilt. The reasons above list every one."}
              </p>
              {failedRowsNote && (
                <p className="mt-1 max-w-2xl text-xs text-gray-700">
                  {failedRowsNote}
                </p>
              )}
              {failedRowsError && (
                <p className="mt-1 max-w-2xl text-xs text-danger-600">
                  {failedRowsError}
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onImportAnother}>
          Import another file
        </Button>
        <Button asChild variant="primary">
          <Link href={listPath}>Go to {listLabel.toLowerCase()} list</Link>
        </Button>
      </div>
    </div>
  );
}
