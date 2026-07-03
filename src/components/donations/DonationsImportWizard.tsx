"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type {
  DonationImportPreview,
  DonationImportResult,
} from "@/types/donations";
import {
  previewDonationsImport,
  commitDonationsImport,
  downloadDonationsTemplate,
} from "@/app/(app)/pay-it-forward/actions";
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

function money(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/**
 * Bulk-import donations from a CSV (super_admin). Columns: MSTID, First name,
 * Last name, Month, Year, Amount. Donors are matched by MSTID, falling back to
 * first + last name; an unmatched or ambiguous donor, or a bad month/year/amount,
 * rejects that row. Text-only controls per the no-icons preference; the backend
 * re-enforces the super_admin gate and validation.
 */
export function DonationsImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [preview, setPreview] = useState<DonationImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  const [result, setResult] = useState<DonationImportResult | null>(null);
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
      const res = await previewDonationsImport(fileForm(file));
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
      const res = await commitDonationsImport(fileForm(file));
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
      const res = await downloadDonationsTemplate();
      if (res.ok) downloadCsv("donations-import-template.csv", res.csv);
      else setTemplateError(res.error);
    });
  };

  const onDownloadRejects = () => {
    if (!result || result.rejects.length === 0) return;
    const esc = (v: string) => {
      let s = String(v);
      // CSV-injection defence: if the value (ignoring leading whitespace) starts
      // with a spreadsheet formula trigger, prefix a single quote so Excel/Sheets
      // treats it as text. Prepending is robust to the leading-whitespace bypass
      // a leading-only strip misses (e.g. " =cmd").
      if (/^\s*[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [
      "row,name,reason",
      ...result.rejects.map((r) =>
        [esc(String(r.row)), esc(r.name), esc(r.reason)].join(","),
      ),
    ];
    downloadCsv("donations-import-rejects.csv", lines.join("\r\n"));
  };

  return (
    <div className="mx-auto max-w-5xl">
      {step === "upload" && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Upload a donations CSV
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Bulk-add Pay It Forward donations. Columns: MSTID, First name,
                  Last name, Month, Year, Amount. Donors are matched to existing
                  alumni by MSTID, falling back to first + last name — an
                  unmatched or ambiguous donor, or a bad month / year / amount,
                  rejects that row. Start from the template so the columns line up.
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

            {fileError && <p className="mt-3 text-sm text-danger-600">{fileError}</p>}

            {file && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="truncate text-sm font-medium text-gray-900">
                  {file.name}{" "}
                  <span className="text-xs font-normal text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => pickFile(null)}>
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
              <Link href="/pay-it-forward">Cancel</Link>
            </Button>
            <Button variant="primary" onClick={onCheck} disabled={!file || checking}>
              {checking ? "Checking…" : "Check file"}
            </Button>
          </div>
        </div>
      )}

      {step === "review" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="Total rows" value={preview.summary.total} />
            <SummaryCard
              label="Importable"
              value={preview.summary.importable}
              tone="success"
            />
            <SummaryCard
              label="Rejected"
              value={preview.summary.rejected}
              tone={preview.summary.rejected > 0 ? "danger" : undefined}
            />
          </div>

          {!preview.columns_ok && (
            <div className="rounded-lg border border-danger-600/40 bg-danger-50 p-4">
              <p className="text-sm font-semibold text-danger-600">
                The file&apos;s columns don&apos;t match the template
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-danger-600">
                {preview.header_errors.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.columns_ok && (
            <Card className="overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">MSTID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.rows.map((r) => (
                    <tr
                      key={r.row}
                      className={r.status === "rejected" ? "bg-danger-50/40" : ""}
                    >
                      <td className="px-3 py-2 tabular-nums text-gray-500">
                        {r.row}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{r.mstid || "—"}</td>
                      <td className="px-3 py-2 text-gray-700">{r.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                        {money(r.amount)}
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {r.month ? `${r.month}/` : ""}
                        {r.year ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "rejected" ? (
                          <span className="text-xs text-danger-600">
                            {r.blockers[0]?.message ?? "Rejected"}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-success-600">
                            OK
                            {r.match_method === "name" && (
                              <span className="ml-1 font-normal text-warning-600">
                                (matched by name — verify)
                              </span>
                            )}
                            {r.warnings.length > 0 && (
                              <span className="ml-1 font-normal text-warning-600">
                                ({r.warnings[0].message})
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {importError && (
            <p className="rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
              {importError}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={onImport}
              disabled={
                !preview.columns_ok ||
                preview.summary.importable === 0 ||
                importing
              }
            >
              {importing
                ? "Importing…"
                : `Import ${preview.summary.importable} donation${
                    preview.summary.importable === 1 ? "" : "s"
                  }`}
            </Button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">Import complete</h2>
            <p className="text-sm text-gray-500">
              {result.imported} donation{result.imported === 1 ? "" : "s"} added
              {result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
              <SummaryCard label="Imported" value={result.imported} tone="success" />
              <SummaryCard
                label="Skipped"
                value={result.skipped}
                tone={result.skipped > 0 ? "danger" : undefined}
              />
            </div>

            {result.rejects.length > 0 && (
              <div className="mt-5 rounded-lg border border-warning-600/30 bg-warning-50 p-4">
                <p className="text-sm font-semibold text-warning-600">
                  {result.rejects.length} row
                  {result.rejects.length === 1 ? " was" : "s were"} skipped
                </p>
                <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
                  {result.rejects.map((r) => (
                    <li key={r.row} className="flex items-baseline gap-2 text-gray-700">
                      <span className="tabular-nums text-gray-500">Row {r.row}</span>
                      <span className="font-medium text-gray-900">{r.name}</span>
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
            <Button
              variant="secondary"
              onClick={() => {
                pickFile(null);
                setStep("upload");
              }}
            >
              Import another file
            </Button>
            <Button asChild variant="primary">
              <Link href="/pay-it-forward">Go to Pay It Forward</Link>
            </Button>
          </div>
        </div>
      )}
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
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </Card>
  );
}
