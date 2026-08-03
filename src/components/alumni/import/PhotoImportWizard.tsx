"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { unzipSync } from "fflate";
import {
  ACCEPT_ATTR,
  HEIC_REASON,
  MAX_FILES,
  MAX_FILE_BYTES,
  REQUEST_CHUNK,
  UPLOAD_CONCURRENCY,
  chunk,
  contentTypeForName,
  formatBytes,
  isArchiveJunk,
  limitBatch,
  mapWithConcurrency,
  partitionPicked,
  type BulkHeadshotConfirmFile,
  type HeadshotBulkItem,
  type HeadshotBulkResult,
  type SkippedFile,
} from "@/lib/photoImport";
import {
  confirmBulkHeadshotUpload,
  getBulkHeadshotUploadUrls,
} from "@/app/(app)/alumni/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Publishable (browser-safe) key, sent on the direct-to-storage PUT — the same
// header the single-headshot upload uses.
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Human label + tone for each per-file status returned by the backend. */
const STATUS_META: Record<string, { label: string; className: string }> = {
  matched: { label: "Matched", className: "text-success-600" },
  no_match: { label: "No match", className: "text-warning-600" },
  invalid: { label: "Invalid", className: "text-danger-600" },
  error: { label: "Error", className: "text-danger-600" },
};

const emptyResult = (): HeadshotBulkResult => ({
  total: 0,
  matched: 0,
  no_match: 0,
  invalid: 0,
  errors: 0,
  items: [],
});

/** Fold a chunk's report into the running total for the whole import. */
function mergeResult(
  into: HeadshotBulkResult,
  next: HeadshotBulkResult,
): HeadshotBulkResult {
  return {
    total: into.total + next.total,
    matched: into.matched + next.matched,
    no_match: into.no_match + next.no_match,
    invalid: into.invalid + next.invalid,
    errors: into.errors + next.errors,
    items: [...into.items, ...next.items],
  };
}

/**
 * Mass photo import (#401), reworked for #595.
 *
 * Each photo is matched to an alumnus by the net ID in its filename
 * (`jsmith.jpg` → net_id `jsmith`), exactly as before. What changed is HOW the
 * bytes travel: the old flow POSTed the whole batch to the API as one multipart
 * body, which Vercel rejects above ~4.5 MB at the edge — surfacing in the
 * browser as a bogus CORS error. Now the API only ever sees metadata:
 *
 *   1. ask the backend for signed upload URLs for a chunk of file names — it
 *      resolves each net ID and only mints a URL for files that matched;
 *   2. PUT each image straight to Supabase Storage, a few at a time;
 *   3. ask the backend to validate + audit what landed and report on it.
 *
 * A `.zip` is expanded here in the browser (fflate) so the existing archive
 * workflow keeps working; its members then follow the same path as picked files.
 * Text-only controls per the app's no-icons convention.
 */
export function PhotoImportWizard() {
  const [files, setFiles] = useState<File[]>([]);
  const [skipped, setSkipped] = useState<SkippedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expanding, setExpanding] = useState(false);

  const [result, setResult] = useState<HeadshotBulkResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [uploading, startUploading] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  /**
   * Expand a `.zip` in the browser. Synchronous on purpose: fflate's async API
   * runs in a worker created from a `blob:` URL, which this app's CSP
   * (`default-src 'self'`, no `worker-src blob:`) refuses. A few dozen photos
   * decompress in well under a second, and the UI shows an "Expanding…" state.
   */
  const expandArchive = async (archive: File): Promise<File[]> => {
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const entries = unzipSync(bytes, { filter: (f) => !isArchiveJunk(f.name) });
    const out: File[] = [];
    for (const [path, data] of Object.entries(entries)) {
      const name = path.replace(/\\/g, "/").split("/").pop() ?? path;
      const type = contentTypeForName(name) ?? "application/octet-stream";
      out.push(new File([data], name, { type }));
    }
    return out;
  };

  const pickFiles = (picked: FileList | File[] | null) => {
    setResult(null);
    setUploadError(null);
    setProgress(null);
    const next = picked ? Array.from(picked) : [];
    if (next.length === 0) {
      setFiles([]);
      setSkipped([]);
      setFileError(null);
      return;
    }

    // Keep every valid photo and report the rest one by one. Discarding the
    // whole batch over one stray file was the second half of #595.
    const { accepted, archives, skipped: rejected } = partitionPicked(next);

    const finish = (images: File[], notes: SkippedFile[]) => {
      const { kept, skipped: trimmed } = limitBatch(images);
      setFiles(kept);
      setSkipped([...notes, ...trimmed]);
      setFileError(
        kept.length === 0
          ? "None of those files can be imported — see the list below."
          : null,
      );
    };

    if (archives.length === 0) {
      finish(accepted, rejected);
      return;
    }

    setExpanding(true);
    void (async () => {
      const images = [...accepted];
      const notes = [...rejected];
      for (const archive of archives) {
        try {
          const members = await expandArchive(archive);
          const inner = partitionPicked(members);
          images.push(...inner.accepted);
          notes.push(...inner.skipped);
          if (inner.accepted.length === 0 && inner.skipped.length === 0) {
            notes.push({
              name: archive.name,
              reason: "The archive has no JPEG, PNG, or WebP photos in it.",
            });
          }
        } catch {
          notes.push({
            name: archive.name,
            reason: "Couldn't read that .zip — re-create it and try again.",
          });
        }
      }
      finish(images, notes);
      setExpanding(false);
    })();
  };

  const onUpload = () => {
    if (files.length === 0) return;
    setUploadError(null);
    startUploading(async () => {
      let report = emptyResult();
      let done = 0;
      setProgress({ done: 0, total: files.length });

      // Metadata rides in chunks so no single request outgrows the backend's
      // per-request cap; the photos themselves never touch it.
      for (const batch of chunk(files, REQUEST_CHUNK)) {
        const minted = await getBulkHeadshotUploadUrls(batch.map((f) => f.name));
        if (!minted.ok) {
          setUploadError(minted.error);
          setProgress(null);
          return;
        }
        // The backend reports one target per name, in the order we sent them.
        if (minted.targets.length !== batch.length) {
          setUploadError("Couldn't import the photos — please try again.");
          setProgress(null);
          return;
        }

        const outcomes = await mapWithConcurrency(
          batch,
          UPLOAD_CONCURRENCY,
          async (file, index): Promise<BulkHeadshotConfirmFile> => {
            const target = minted.targets[index];
            // No URL means the backend didn't match this file to an alumnus (or
            // storage was unavailable). Report it; never invent a destination.
            if (!target?.upload_url) {
              done += 1;
              setProgress({ done, total: files.length });
              return { filename: file.name, uploaded: false };
            }
            let outcome: BulkHeadshotConfirmFile;
            try {
              const put = await fetch(target.upload_url, {
                method: "PUT",
                headers: {
                  "content-type":
                    contentTypeForName(file.name) ?? "application/octet-stream",
                  "x-upsert": "true",
                  apikey: SUPABASE_KEY,
                },
                body: file,
              });
              outcome = put.ok
                ? { filename: file.name, uploaded: true }
                : {
                    filename: file.name,
                    uploaded: false,
                    message:
                      put.status === 413
                        ? "The photo is over the 20 MB limit."
                        : "Storage rejected the upload — try this one again.",
                  };
            } catch {
              outcome = {
                filename: file.name,
                uploaded: false,
                message: "The upload didn't finish — check your connection.",
              };
            }
            done += 1;
            setProgress({ done, total: files.length });
            return outcome;
          },
        );

        const confirmed = await confirmBulkHeadshotUpload(outcomes);
        if (!confirmed.ok) {
          setUploadError(confirmed.error);
          setProgress(null);
          return;
        }
        report = mergeResult(report, confirmed.result);
      }

      setProgress(null);
      setResult(report);
    });
  };

  const reset = () => {
    setFiles([]);
    setSkipped([]);
    setFileError(null);
    setResult(null);
    setUploadError(null);
    setProgress(null);
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

        {skipped.length > 0 && (
          <Card className="p-4">
            <SkippedList
              skipped={skipped}
              caption="Left out before the upload started, so they aren't in the table above."
            />
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
          Bulk-add alumni headshots. Drop in image files, a <strong>.zip</strong>{" "}
          of images, or both. Each photo is matched to an alumnus by the{" "}
          <strong>net ID in its filename</strong> — e.g.{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700">
            jsmith.jpg
          </code>{" "}
          uploads to the alumnus with net&nbsp;ID{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700">
            jsmith
          </code>
          . Files whose net ID doesn&apos;t match anyone are reported back, not
          uploaded.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          JPEG, PNG, or WebP — up to {formatBytes(MAX_FILE_BYTES)} per photo and{" "}
          {MAX_FILES.toLocaleString()} photos per import. Photos upload straight
          to storage, so there&apos;s no cap on the batch as a whole; a big batch
          just takes a while, so leave this page open until it finishes.{" "}
          <strong>HEIC isn&apos;t supported</strong> — convert iPhone photos to
          JPEG first.
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
            Drag photos or a .zip here, or click to choose
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Anything that isn&apos;t a JPEG, PNG, or WebP is listed and skipped —
            the rest of the batch still uploads
          </p>
        </label>

        {fileError && (
          <p className="mt-3 rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
            {fileError}
          </p>
        )}

        {expanding && (
          <p className="mt-3 text-sm text-gray-500">Expanding archive…</p>
        )}

        {files.length > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {files.length === 1
                  ? files[0].name
                  : `${files.length.toLocaleString()} photos ready to import`}
              </p>
              <p className="text-xs tabular-nums text-gray-500">
                {formatBytes(totalBytes)} total
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pickFiles(null)}
              disabled={uploading}
            >
              Remove
            </Button>
          </div>
        )}

        <SkippedList
          skipped={skipped}
          caption="Skipped — the rest of the batch is unaffected."
        />

        {progress && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-gray-700">Uploading photos…</span>
              <span className="tabular-nums text-gray-500">
                {progress.done.toLocaleString()} of{" "}
                {progress.total.toLocaleString()}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              aria-label="Photo upload progress"
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
            >
              <div
                className="h-full bg-brand-blue-600"
                style={{
                  width: `${Math.round(
                    (progress.done / Math.max(progress.total, 1)) * 100,
                  )}%`,
                }}
              />
            </div>
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
          disabled={files.length === 0 || uploading || expanding}
        >
          {uploading
            ? "Uploading…"
            : files.length === 0
              ? "Upload photos"
              : `Upload ${files.length.toLocaleString()} photo${
                  files.length === 1 ? "" : "s"
                }`}
        </Button>
      </div>
    </div>
  );
}

/**
 * Files left out before the upload — a stray `.DS_Store`, a HEIC, an oversized
 * photo. Listed individually rather than silently dropped, and WITHOUT
 * discarding the rest of the selection (#595).
 */
function SkippedList({
  skipped,
  caption,
}: {
  skipped: SkippedFile[];
  caption: string;
}) {
  if (skipped.length === 0) return null;
  const heic = skipped.some((s) => s.reason === HEIC_REASON);
  return (
    <div className="mt-4 rounded-lg border border-warning-600/30 bg-warning-50 px-3 py-2.5">
      <p className="text-sm font-medium text-gray-900">
        {skipped.length.toLocaleString()} file
        {skipped.length === 1 ? "" : "s"} skipped
      </p>
      <p className="mt-0.5 text-xs text-gray-600">{caption}</p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-gray-700">
        {skipped.map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex gap-2">
            <span className="max-w-[14rem] shrink-0 truncate font-medium">
              {s.name}
            </span>
            <span className="text-gray-500">{s.reason}</span>
          </li>
        ))}
      </ul>
      {heic && (
        <p className="mt-2 text-xs text-gray-600">
          HEIC is what iPhones save by default. Switching the camera format is a
          one-time change, or export the photos as JPEG before importing.
        </p>
      )}
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
