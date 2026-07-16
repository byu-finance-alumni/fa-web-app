"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type {
  UpdateImportPreview,
  UpdateImportRowReport,
  UpdateImportResult,
  UpdateImportRowResult,
} from "@/types/alumni";
import {
  previewUpdateImport,
  commitUpdateImport,
  downloadCohortUpdateCsv,
  getGraduationYears,
} from "@/app/(app)/alumni/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Step = "upload" | "review" | "result";

/** Build a FormData carrying the single file under the `file` key. */
function fileForm(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file, file.name);
  return fd;
}

/** Trigger a browser download of `text` as `filename` (client-side Blob). */
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

/** Pretty-print a before/after cell value for a change diff. */
function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** snake_case field name → a readable label (e.g. "current_employer" → "Current employer"). */
function fieldLabel(field: string): string {
  const spaced = field.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : field;
}

/**
 * "Update existing (CSV)" wizard (round-trip cohort update). Mirrors
 * {@link ImportWizard}'s upload → preview → confirm → result flow, but calls the
 * mass-UPDATE endpoints: matched by BYU/Net ID, blank cells left unchanged,
 * unmatched rows reported (never created). Text-only controls, no icons.
 */
export function UpdateImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [preview, setPreview] = useState<UpdateImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  const [result, setResult] = useState<UpdateImportResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updating, startUpdating] = useTransition();

  // Step 1 — export a cohort. The year list mirrors the alumni-list filters
  // (FilterOptions.graduation_years); if it can't load we fall back to a plain
  // year input so export still works.
  const [gradYears, setGradYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, startExporting] = useTransition();

  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void getGraduationYears().then((res) => {
      if (active && res.ok) setGradYears(res.years);
    });
    return () => {
      active = false;
    };
  }, []);

  const onExport = () => {
    const year = Number(selectedYear);
    if (!selectedYear || !Number.isFinite(year)) {
      setExportError("Pick a class year to export.");
      return;
    }
    setExportError(null);
    startExporting(async () => {
      const res = await downloadCohortUpdateCsv(year);
      if (res.ok) {
        downloadCsv(`alumni-${year}-update.csv`, res.csv);
      } else {
        setExportError(res.error);
      }
    });
  };

  const pickFile = (next: File | null) => {
    setPreview(null);
    setPreviewError(null);
    setResult(null);
    setUpdateError(null);
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
      const res = await previewUpdateImport(fileForm(file));
      if (res.ok) {
        setPreview(res.data);
        setStep("review");
      } else {
        setPreviewError(res.error);
      }
    });
  };

  const onApply = () => {
    if (!file) return;
    setUpdateError(null);
    startUpdating(async () => {
      const res = await commitUpdateImport(fileForm(file));
      if (res.ok) {
        setResult(res.data);
        setStep("result");
      } else {
        setUpdateError(res.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <StepHeader step={step} />

      {step === "upload" && (
        <div className="space-y-4">
          <ExportStep
            gradYears={gradYears}
            selectedYear={selectedYear}
            exporting={exporting}
            exportError={exportError}
            onSelectYear={(v) => {
              setSelectedYear(v);
              setExportError(null);
            }}
            onExport={onExport}
          />
          <UploadStep
            file={file}
            fileError={fileError}
            dragOver={dragOver}
            checking={checking}
            previewError={previewError}
            inputRef={inputRef}
            setDragOver={setDragOver}
            onPick={pickFile}
            onCheck={onCheck}
          />
        </div>
      )}

      {step === "review" && preview && (
        <ReviewStep
          preview={preview}
          updating={updating}
          updateError={updateError}
          onBack={() => {
            pickFile(null);
            setStep("upload");
          }}
          onApply={onApply}
        />
      )}

      {step === "result" && result && (
        <ResultStep
          result={result}
          onUpdateAnother={() => {
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
    { id: "upload", label: "Export & upload" },
    { id: "review", label: "Review" },
    { id: "result", label: "Done" },
  ];
  const activeIndex = steps.findIndex((s) => s.id === step);
  return (
    <ol
      className="mb-6 flex items-center text-sm"
      aria-label={`Update step ${activeIndex + 1} of ${steps.length}: ${
        steps[activeIndex]?.label ?? ""
      }`}
    >
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li
            key={s.id}
            className={
              i < steps.length - 1
                ? "flex flex-1 items-center"
                : "flex items-center"
            }
          >
            <span
              className="flex items-center gap-2"
              aria-current={active ? "step" : undefined}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? "bg-brand-blue-600 text-white ring-2 ring-brand-blue-100"
                    : done
                      ? "bg-success-600 text-white"
                      : "border border-gray-300 bg-white text-gray-400"
                }`}
              >
                {i + 1}
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

/* -------------------------------------------------- step 1a: export cohort --- */

function ExportStep({
  gradYears,
  selectedYear,
  exporting,
  exportError,
  onSelectYear,
  onExport,
}: {
  gradYears: number[];
  selectedYear: string;
  exporting: boolean;
  exportError: string | null;
  onSelectYear: (v: string) => void;
  onExport: () => void;
}) {
  const hasYears = gradYears.length > 0;
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Step 1 — Export a class year
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Pick a class year, export it, edit the cells you need, then upload it
          back below to apply the changes.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label htmlFor="cohort-year" className="mb-1.5">
            Graduation year
          </Label>
          {hasYears ? (
            <Select
              id="cohort-year"
              value={selectedYear}
              onChange={(e) => onSelectYear(e.target.value)}
            >
              <option value="">Select a year…</option>
              {gradYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="cohort-year"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 2024"
              value={selectedYear}
              onChange={(e) => onSelectYear(e.target.value)}
            />
          )}
        </div>
        <Button
          variant="secondary"
          onClick={onExport}
          disabled={!selectedYear || exporting}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {exportError && (
        <p className="mt-3 text-sm text-danger-600">{exportError}</p>
      )}
    </Card>
  );
}

/* ------------------------------------------------ step 1b: upload edited csv --- */

function UploadStep({
  file,
  fileError,
  dragOver,
  checking,
  previewError,
  inputRef,
  setDragOver,
  onPick,
  onCheck,
}: {
  file: File | null;
  fileError: string | null;
  dragOver: boolean;
  checking: boolean;
  previewError: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setDragOver: (v: boolean) => void;
  onPick: (f: File | null) => void;
  onCheck: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Step 2 — Upload the edited CSV
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            After editing the exported file, upload it here. Blank cells are left
            unchanged; only existing profiles (matched by BYU ID, then Net ID)
            are updated — unmatched rows are reported, never created.
          </p>
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
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-gray-900">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPick(null)}
              aria-label="Remove file"
            >
              Remove
            </Button>
          </div>
        )}

        {previewError && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5">
            <p className="text-sm text-danger-600">{previewError}</p>
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
          <Link href="/alumni">Cancel</Link>
        </Button>
        <Button variant="primary" onClick={onCheck} disabled={!file || checking}>
          {checking ? "Checking…" : "Check file"}
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- step 2: review --- */

function ReviewStep({
  preview,
  updating,
  updateError,
  onBack,
  onApply,
}: {
  preview: UpdateImportPreview;
  updating: boolean;
  updateError: string | null;
  onBack: () => void;
  onApply: () => void;
}) {
  const { summary, columns_ok, header_errors, rows } = preview;

  const changed = rows.filter((r) => r.status === "update");
  const unmatched = rows.filter(
    (r) => r.status === "unmatched" || r.status === "unmatched_archived",
  );
  const errored = rows.filter((r) => r.status === "error");
  const nothingToDo = columns_ok && summary.with_changes === 0;
  const canApply = columns_ok && summary.with_changes > 0;

  return (
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Rows in file" value={summary.total} />
        <SummaryCard label="Matched" value={summary.matched} />
        <SummaryCard
          label="Will update"
          value={summary.with_changes}
          tone={summary.with_changes > 0 ? "success" : undefined}
        />
        <SummaryCard
          label="Unmatched"
          value={summary.unmatched}
          tone={summary.unmatched > 0 ? "warning" : undefined}
        />
        <SummaryCard
          label="Errors"
          value={summary.errors}
          tone={summary.errors > 0 ? "danger" : undefined}
        />
      </div>

      <p className="text-sm text-gray-700">
        <span className="font-semibold text-gray-900">
          {summary.with_changes}
        </span>{" "}
        profile{summary.with_changes === 1 ? "" : "s"} will be updated
        {" · "}
        {summary.unmatched} unmatched
        {" · "}
        {summary.errors} error{summary.errors === 1 ? "" : "s"}
      </p>

      {!columns_ok && (
        <div className="rounded-lg border border-danger-600/40 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-600">
            The file&apos;s columns don&apos;t match the export
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-1 text-sm text-danger-600">
            {header_errors.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-gray-700">
            Re-export the cohort, edit that file, and upload it again — no
            profiles can be updated until the columns match.
          </p>
        </div>
      )}

      {nothingToDo && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nothing will change. Every matched row already holds the values in
          this file.
        </div>
      )}

      {columns_ok && changed.length > 0 && (
        <ChangeTable rows={changed} />
      )}

      {columns_ok && unmatched.length > 0 && (
        <UnmatchedList rows={unmatched} />
      )}

      {columns_ok && errored.length > 0 && (
        <ErrorList rows={errored} />
      )}

      {updateError && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5">
          <p className="text-sm text-danger-600">{updateError}</p>
          <Button
            variant="link"
            size="sm"
            onClick={onApply}
            className="shrink-0 px-0 text-danger-600 hover:text-danger-600"
          >
            Retry
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Choose a different file
        </Button>
        <Button
          variant="primary"
          onClick={onApply}
          disabled={!canApply || updating}
        >
          {updating
            ? "Applying…"
            : `Apply ${summary.with_changes} update${
                summary.with_changes === 1 ? "" : "s"
              }`}
        </Button>
      </div>
    </div>
  );
}

/** The matched-and-changed rows: name + each field change as `Field: old → new`. */
function ChangeTable({ rows }: { rows: UpdateImportRowReport[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Changes ({rows.length})
      </p>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-16 px-3 py-2 text-right">Row</th>
                <th className="w-56 px-3 py-2">Name</th>
                <th className="px-3 py-2">Changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.row}
                  className="border-t border-gray-200 align-top hover:bg-gray-50"
                >
                  <td className="px-3 py-2 text-right align-top tabular-nums text-gray-500">
                    {row.row}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="font-medium text-gray-900">
                      {row.name || "—"}
                    </span>
                    {row.alumni_id != null && (
                      <Link
                        href={`/alumni/${row.alumni_id}`}
                        className="ml-2 text-xs font-medium text-brand-blue-600 underline hover:text-brand-blue-500"
                      >
                        View #{row.alumni_id}
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-gray-700">
                    <ul className="space-y-1">
                      {row.changes.map((c, i) => (
                        <li key={`${c.field}-${i}`}>
                          <span className="font-medium text-gray-900">
                            {fieldLabel(c.field)}:
                          </span>{" "}
                          <span className="text-gray-500 line-through">
                            {fmt(c.old)}
                          </span>{" "}
                          <span aria-hidden="true">→</span>{" "}
                          <span className="text-gray-900">{fmt(c.new)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Rows with no active match — reported, never created. */
function UnmatchedList({ rows }: { rows: UpdateImportRowReport[] }) {
  return (
    <div className="rounded-lg border border-warning-600/30 bg-warning-50 p-4">
      <p className="text-sm font-semibold text-warning-600">
        {rows.length} unmatched row{rows.length === 1 ? "" : "s"} (not updated)
      </p>
      <p className="mt-1 text-sm text-gray-700">
        No active profile matched these rows by BYU or Net ID — they are skipped,
        never created.
      </p>
      <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
        {rows.map((r) => (
          <li key={r.row} className="flex items-baseline gap-2 text-gray-700">
            <span className="shrink-0 tabular-nums text-gray-500">
              Row {r.row}
            </span>
            <span className="font-medium text-gray-900">{r.name || "—"}</span>
            {r.message && (
              <span className="text-warning-600">— {r.message}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rows that failed to map/validate. */
function ErrorList({ rows }: { rows: UpdateImportRowReport[] }) {
  return (
    <div className="rounded-lg border border-danger-600/30 bg-danger-50 p-4">
      <p className="text-sm font-semibold text-danger-600">
        {rows.length} row{rows.length === 1 ? "" : "s"} with errors (not updated)
      </p>
      <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
        {rows.map((r) => (
          <li key={r.row} className="flex items-baseline gap-2 text-gray-700">
            <span className="shrink-0 tabular-nums text-gray-500">
              Row {r.row}
            </span>
            <span className="font-medium text-gray-900">{r.name || "—"}</span>
            <span className="text-danger-600">
              — {r.error || "Couldn't process this row."}
            </span>
          </li>
        ))}
      </ul>
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
  result,
  onUpdateAnother,
}: {
  result: UpdateImportResult;
  onUpdateAnother: () => void;
}) {
  const updated = result.results.filter((r) => r.status === "updated");
  const unmatched = result.results.filter(
    (r) => r.status === "unmatched" || r.status === "unmatched_archived",
  );
  const errored = result.results.filter((r) => r.status === "error");

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">Update complete</h2>
        <p className="text-sm text-gray-500">
          {result.updated} profile{result.updated === 1 ? "" : "s"} updated
          {result.unchanged > 0 ? `, ${result.unchanged} unchanged` : ""}
          {result.unmatched > 0 ? `, ${result.unmatched} unmatched` : ""}
          {result.errors > 0 ? `, ${result.errors} error${
            result.errors === 1 ? "" : "s"
          }` : ""}
          .
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Updated" value={result.updated} tone="success" />
          <SummaryCard label="Unchanged" value={result.unchanged} />
          <SummaryCard
            label="Unmatched"
            value={result.unmatched}
            tone={result.unmatched > 0 ? "warning" : undefined}
          />
          <SummaryCard
            label="Errors"
            value={result.errors}
            tone={result.errors > 0 ? "danger" : undefined}
          />
        </div>

        {updated.length > 0 && (
          <div className="mt-5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Updated ({updated.length})
            </p>
            <ul className="max-h-48 space-y-1 overflow-auto text-sm">
              {updated.map((r) => (
                <ResultRow key={r.row} row={r} tone="success" />
              ))}
            </ul>
          </div>
        )}

        {unmatched.length > 0 && (
          <div className="mt-5 rounded-lg border border-warning-600/30 bg-warning-50 p-4">
            <p className="text-sm font-semibold text-warning-600">
              {unmatched.length} unmatched row
              {unmatched.length === 1 ? "" : "s"} (not updated)
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
              {unmatched.map((r) => (
                <ResultRow key={r.row} row={r} tone="warning" />
              ))}
            </ul>
          </div>
        )}

        {errored.length > 0 && (
          <div className="mt-5 rounded-lg border border-danger-600/30 bg-danger-50 p-4">
            <p className="text-sm font-semibold text-danger-600">
              {errored.length} row{errored.length === 1 ? "" : "s"} with errors
              (not updated)
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
              {errored.map((r) => (
                <ResultRow key={r.row} row={r} tone="danger" />
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onUpdateAnother}>
          Update another file
        </Button>
        <Button asChild variant="primary">
          <Link href="/alumni">Go to alumni list</Link>
        </Button>
      </div>
    </div>
  );
}

function ResultRow({
  row,
  tone,
}: {
  row: UpdateImportRowResult;
  tone: "success" | "warning" | "danger";
}) {
  const msgClass =
    tone === "danger"
      ? "text-danger-600"
      : tone === "warning"
        ? "text-warning-600"
        : "text-gray-500";
  return (
    <li className="flex items-baseline gap-2 text-gray-700">
      <span className="shrink-0 tabular-nums text-gray-500">Row {row.row}</span>
      <span className="font-medium text-gray-900">{row.name || "—"}</span>
      {row.alumni_id != null && tone === "success" && (
        <Badge variant="tag">#{row.alumni_id}</Badge>
      )}
      {row.message && <span className={msgClass}>— {row.message}</span>}
    </li>
  );
}
