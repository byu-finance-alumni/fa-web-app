"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { components } from "@/types/api.gen";
import { clientPostForm, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type HeadshotBulkResult = components["schemas"]["HeadshotBulkResult"];
type HeadshotBulkItem = components["schemas"]["HeadshotBulkItem"];

// Mirror the backend's accepted image types and per-request ceilings (#401). The
// backend re-enforces every one of these; the client checks are purely for a
// friendly, immediate message before a large upload leaves the browser.
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const ZIP_EXTS = [".zip"];
const ACCEPT_ATTR = ".zip,image/jpeg,image/png,image/webp";
const MAX_FILES = 1000;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

const hasExt = (name: string, exts: string[]) =>
  exts.some((ext) => name.toLowerCase().endsWith(ext));

const isZip = (file: File) =>
  hasExt(file.name, ZIP_EXTS) ||
  file.type === "application/zip" ||
  file.type === "application/x-zip-compressed";

const isImage = (file: File) =>
  hasExt(file.name, IMAGE_EXTS) || file.type.startsWith("image/");

const fmtBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

/** Human label + tone for each per-file status returned by the backend. */
const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  matched: { label: "Matched", className: "text-success-600" },
  no_match: { label: "No match", className: "text-warning-600" },
  invalid: { label: "Invalid", className: "text-danger-600" },
  error: { label: "Error", className: "text-danger-600" },
};

/**
 * Mass photo import (#401). Uploads EITHER a single .zip of images OR many image
 * files in one request to `POST /alumni/headshots/bulk`. Each photo is matched to
 * an alumnus by the net ID in its filename (`jsmith.jpg` → net_id `jsmith`).
 *
 * The upload goes straight to the backend via {@link clientPostForm} — not a
 * Server Action — because the batch can reach 200 MB, far over the serverless
 * body cap. The route is full_access+ and rate-limited (10 req / 10 min); a 429
 * surfaces a friendly "try again shortly" message. Text-only controls per the
 * app's no-icons convention.
 */
export function PhotoImportWizard() {
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [result, setResult] = useState<HeadshotBulkResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUploading] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const zipCount = files.filter(isZip).length;

  const pickFiles = (picked: FileList | File[] | null) => {
    setResult(null);
    setUploadError(null);
    const next = picked ? Array.from(picked) : [];
    if (next.length === 0) {
      setFiles([]);
      setFileError(null);
      return;
    }

    const rejected = next.filter((f) => !isZip(f) && !isImage(f));
    if (rejected.length > 0) {
      setFiles([]);
      setFileError(
        `${rejected.length} file${rejected.length === 1 ? " isn't" : "s aren't"} a .zip or an image (JPEG, PNG, WebP). Choose a single .zip of photos, or image files.`,
      );
      return;
    }

    const zips = next.filter(isZip);
    if (zips.length > 1) {
      setFiles([]);
      setFileError("Upload only one .zip at a time.");
      return;
    }
    if (zips.length === 1 && next.length > 1) {
      setFiles([]);
      setFileError(
        "Upload a single .zip on its own, or individual image files — not both together.",
      );
      return;
    }

    if (next.length > MAX_FILES) {
      setFiles([]);
      setFileError(
        `That's ${next.length.toLocaleString()} files — the limit is ${MAX_FILES.toLocaleString()} per upload. Split them into smaller batches or use a .zip.`,
      );
      return;
    }

    const bytes = next.reduce((sum, f) => sum + f.size, 0);
    if (bytes > MAX_TOTAL_BYTES) {
      setFiles([]);
      setFileError(
        `That's ${fmtBytes(bytes)} — the limit is 200 MB per upload. Split the photos into smaller batches.`,
      );
      return;
    }

    setFileError(null);
    setFiles(next);
  };

  const onUpload = () => {
    if (files.length === 0) return;
    setUploadError(null);
    startUploading(async () => {
      const fd = new FormData();
      for (const f of files) fd.append("files", f, f.name);
      try {
        const data = await clientPostForm<HeadshotBulkResult>(
          "/alumni/headshots/bulk",
          fd,
        );
        setResult(data);
      } catch (e) {
        if (e instanceof ApiClientError) {
          if (e.status === 429) {
            setUploadError(
              "Too many photo uploads in a short window. Please wait a few minutes and try again.",
            );
          } else if (e.status === 413) {
            setUploadError(
              "That upload is too large. Keep each batch under 200 MB.",
            );
          } else if (e.status === 401 || e.status === 403) {
            setUploadError(
              "You don't have permission to import photos, or your session expired. Sign in again and retry.",
            );
          } else {
            setUploadError(
              e.message ||
                "Couldn't upload the photos — please try again.",
            );
          }
        } else {
          setUploadError("Couldn't upload the photos — please try again.");
        }
      }
    });
  };

  const reset = () => {
    setFiles([]);
    setFileError(null);
    setResult(null);
    setUploadError(null);
  };

  // --- Results view ---------------------------------------------------------
  if (result) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Photo import complete
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {result.matched} of {result.total} photo
            {result.total === 1 ? "" : "s"} matched an alumnus and were uploaded.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCard label="Total" value={result.total} />
            <SummaryCard label="Matched" value={result.matched} tone="success" />
            <SummaryCard
              label="No match"
              value={result.no_match}
              tone={result.no_match > 0 ? "warning" : undefined}
            />
            <SummaryCard
              label="Invalid"
              value={result.invalid}
              tone={result.invalid > 0 ? "danger" : undefined}
            />
            <SummaryCard
              label="Errors"
              value={result.errors}
              tone={result.errors > 0 ? "danger" : undefined}
            />
          </div>
        </Card>

        {result.items.length > 0 && (
          <Card className="overflow-hidden p-0">
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Net ID</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.items.map((item, i) => (
                    <ResultRow key={`${item.filename}-${i}`} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={reset}>
            Import more photos
          </Button>
          <Button asChild variant="primary">
            <Link href="/alumni">Go to alumni list</Link>
          </Button>
        </div>
      </div>
    );
  }

  // --- Upload view ----------------------------------------------------------
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">Import photos</h2>
        <p className="mt-1 text-sm text-gray-500">
          Bulk-add alumni headshots. Upload a single <strong>.zip</strong> of
          images, or select many image files at once. Each photo is matched to an
          alumnus by the <strong>net ID in its filename</strong> — e.g.{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700">
            jsmith.jpg
          </code>{" "}
          uploads to the alumnus with net&nbsp;ID{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700">
            jsmith
          </code>
          . Files whose net ID doesn&apos;t match anyone are reported back, not
          uploaded. JPEG, PNG, or WebP — up to 1,000 files / 200&nbsp;MB per
          upload.
        </p>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) pickFiles(e.dataTransfer.files);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition ${
            dragOver
              ? "border-brand-blue-600 bg-brand-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-brand-blue-300 hover:bg-brand-blue-50/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            className="sr-only"
            onChange={(e) => {
              pickFiles(e.target.files);
              // Reset so re-selecting the SAME files still fires onChange.
              e.target.value = "";
            }}
          />
          <p className="text-sm font-medium text-gray-900">
            Drag a .zip or image files here, or click to choose
          </p>
          <p className="mt-1 text-xs text-gray-500">
            One .zip of photos, or multiple JPEG / PNG / WebP files
          </p>
        </label>

        {fileError && (
          <p className="mt-3 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
            {fileError}
          </p>
        )}

        {files.length > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {zipCount === 1
                  ? files[0].name
                  : `${files.length.toLocaleString()} image file${
                      files.length === 1 ? "" : "s"
                    } selected`}
              </p>
              <p className="text-xs text-gray-500">
                {zipCount === 1 ? "Archive" : "Total"} {fmtBytes(totalBytes)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => pickFiles(null)}>
              Remove
            </Button>
          </div>
        )}

        {uploadError && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5">
            <p className="text-sm text-danger-600">{uploadError}</p>
            <Button
              variant="link"
              size="sm"
              onClick={onUpload}
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
        <Button
          variant="primary"
          onClick={onUpload}
          disabled={files.length === 0 || uploading}
        >
          {uploading
            ? "Uploading…"
            : files.length === 0
              ? "Upload photos"
              : zipCount === 1
                ? "Upload archive"
                : `Upload ${files.length.toLocaleString()} photo${
                    files.length === 1 ? "" : "s"
                  }`}
        </Button>
      </div>
    </div>
  );
}

function ResultRow({ item }: { item: HeadshotBulkItem }) {
  const meta = STATUS_META[item.status] ?? {
    label: item.status,
    className: "text-gray-700",
  };
  return (
    <tr className={item.status === "matched" ? "" : "bg-danger-50/30"}>
      <td className="px-3 py-2 font-medium text-gray-900">{item.filename}</td>
      <td className="px-3 py-2 text-gray-700">{item.net_id || "—"}</td>
      <td className={`px-3 py-2 text-xs font-semibold ${meta.className}`}>
        {meta.label}
      </td>
      <td className="px-3 py-2 text-gray-500">{item.message || "—"}</td>
    </tr>
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
