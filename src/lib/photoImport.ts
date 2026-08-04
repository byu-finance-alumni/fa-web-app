/**
 * Rules and small helpers for the bulk alumni photo import (#401, reworked for
 * #595). Framework-free and side-effect-free so the selection/limit logic can be
 * unit-tested without a DOM — the wizard component owns the UI and the network.
 *
 * The backend re-enforces every rule here (net ID matching, the image
 * allow-list, the per-file cap, and the per-request batch cap). These checks
 * exist so the operator gets an immediate, specific message instead of watching
 * a long upload fail.
 */

import type { components } from "@/types/api.gen";

/** The per-file report + tallies the wizard renders, straight from the API. */
export type HeadshotBulkResult = components["schemas"]["HeadshotBulkResult"];
export type HeadshotBulkItem = components["schemas"]["HeadshotBulkItem"];

/**
 * One file's mint outcome from `POST /alumni/headshots/bulk/upload-urls`.
 * `status` is `ready` (upload_url present) | `no_match` | `invalid` | `error`.
 */
export type BulkHeadshotUploadTarget =
  components["schemas"]["HeadshotBulkUploadTarget"];

/** One file's upload outcome sent to `POST /alumni/headshots/bulk/confirm`. */
export type BulkHeadshotConfirmFile =
  components["schemas"]["HeadshotBulkConfirmFile"];

/** Image types the headshots bucket accepts. Content is sniffed server-side. */
export const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
export const ZIP_EXTS = [".zip"];
/** iPhone's default format. Not supported — see `HEIC_REASON`. */
export const HEIC_EXTS = [".heic", ".heif"];
export const ACCEPT_ATTR = ".zip,image/jpeg,image/png,image/webp";

/** Photos per import. Nothing streams through our API, so this is about keeping
 *  one screenful of work reviewable, not a platform limit. */
export const MAX_FILES = 1000;
/** Per-file ceiling — the `headshots` bucket's own limit. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Files per metadata request. MUST stay <= the backend's
 *  `_HEADSHOT_BULK_MAX_PER_REQUEST`; larger imports are sent as chunks. */
export const REQUEST_CHUNK = 100;
/** Simultaneous direct-to-storage PUTs. Enough to saturate a normal uplink
 *  without opening a connection per photo. */
export const UPLOAD_CONCURRENCY = 4;

// Zip expansion moved from the server to the browser, so the caps that used to
// guard it there have to come along — a decompression bomb now costs the
// operator their tab instead of our function. These bound the raw archive we
// read into memory, the total we let it expand to, and how many members we'll
// even walk.
export const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
export const MAX_ARCHIVE_EXPANDED_BYTES = 400 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 10_000;

export const HEIC_REASON =
  "HEIC/HEIF isn't supported. On iPhone set Settings > Camera > Formats to " +
  '"Most Compatible", or export the photo as JPEG, then re-add it.';
const NOT_IMAGE_REASON = "Not a JPEG, PNG, or WebP image (or a .zip of them).";
const TOO_LARGE_REASON = "Larger than the 20 MB per-photo limit.";
const EMPTY_REASON = "The file is empty.";
export const OVER_LIMIT_REASON = `Over the ${MAX_FILES.toLocaleString()}-photo limit for one import.`;

/** A file left out of the batch, with the reason to show the operator. */
export type SkippedFile = { name: string; reason: string };

/** Result of vetting a drag/drop or file-picker selection. */
export type PickedFiles = {
  /** Image files that will be uploaded. */
  accepted: File[];
  /** `.zip` archives to expand client-side into more images. */
  archives: File[];
  /** Everything left out, each with a reason. Never silently dropped. */
  skipped: SkippedFile[];
};

const lowerExt = (name: string) => {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
};

export const isZipName = (name: string) => ZIP_EXTS.includes(lowerExt(name));
export const isHeicName = (name: string) => HEIC_EXTS.includes(lowerExt(name));
export const isImageName = (name: string) => IMAGE_EXTS.includes(lowerExt(name));

/** MIME to send on the direct PUT, or null when the name isn't an accepted
 *  image. Mirrors the backend's extension -> MIME map. */
export function contentTypeForName(name: string): string | null {
  switch (lowerExt(name)) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

/** The net ID a file name maps to: basename minus extension. Mirrors the
 *  backend's `_net_id_from_filename` (which is the authority — this is only
 *  used for local display). */
export function netIdFromFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return (dot > 0 ? base.slice(0, dot) : base).trim();
}

/** True for zip members that are directories or OS metadata rather than photos
 *  (`__MACOSX/…`, `.DS_Store`, resource forks). */
export function isArchiveJunk(path: string): boolean {
  if (path.endsWith("/")) return true;
  const normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("__MACOSX/") || normalized.includes("/__MACOSX/")) {
    return true;
  }
  const base = normalized.split("/").pop() ?? "";
  return base === "" || base.startsWith(".");
}

/** What a zip member has to say about itself before we decompress it. */
export type ArchiveEntryInfo = { name: string; originalSize: number };

/**
 * Build the stateful `filter` for a single archive expansion: it decides which
 * members are decompressed AT ALL, so the caps apply before the bytes are
 * allocated rather than after.
 *
 * Drops OS junk, refuses any member declaring more than the per-photo limit,
 * stops once the declared sizes add up to `MAX_ARCHIVE_EXPANDED_BYTES`, and
 * stops walking after `MAX_ARCHIVE_ENTRIES` members. Declared sizes come from
 * the archive itself, so they can lie — a member that lies SMALL then overruns
 * fails to inflate and is dropped by the caller, and one that lies LARGE only
 * excludes itself. Either way the budget holds.
 */
export function makeArchiveFilter(): (entry: ArchiveEntryInfo) => boolean {
  let budget = MAX_ARCHIVE_EXPANDED_BYTES;
  let seen = 0;
  return (entry) => {
    if (seen++ >= MAX_ARCHIVE_ENTRIES) return false;
    if (isArchiveJunk(entry.name)) return false;
    const size = entry.originalSize ?? 0;
    if (size > MAX_FILE_BYTES || size > budget) return false;
    budget -= size;
    return true;
  };
}

/**
 * Vet a selection, KEEPING the good files. One stray `.DS_Store` or HEIC in a
 * 50-photo drag must not discard the batch (#595) — every rejected file is
 * reported individually instead.
 */
export function partitionPicked(files: File[]): PickedFiles {
  const accepted: File[] = [];
  const archives: File[] = [];
  const skipped: SkippedFile[] = [];
  for (const file of files) {
    if (isZipName(file.name)) {
      archives.push(file);
      continue;
    }
    if (isHeicName(file.name)) {
      skipped.push({ name: file.name, reason: HEIC_REASON });
      continue;
    }
    if (!isImageName(file.name)) {
      skipped.push({ name: file.name, reason: NOT_IMAGE_REASON });
      continue;
    }
    if (file.size === 0) {
      skipped.push({ name: file.name, reason: EMPTY_REASON });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      skipped.push({ name: file.name, reason: TOO_LARGE_REASON });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, archives, skipped };
}

/**
 * Trim a batch to `MAX_FILES`, reporting the overflow rather than failing the
 * whole selection. De-dupes by file name first: the same net ID twice would
 * upload to the same object key, so only the last one could ever survive.
 */
export function limitBatch(files: File[]): { kept: File[]; skipped: SkippedFile[] } {
  const kept: File[] = [];
  const skipped: SkippedFile[] = [];
  const seen = new Map<string, number>();
  for (const file of files) {
    const key = file.name.toLowerCase();
    const at = seen.get(key);
    if (at !== undefined) {
      // Later pick wins, matching the storage upsert the backend performs.
      skipped.push({
        name: kept[at].name,
        reason: "Replaced by another file with the same name.",
      });
      kept[at] = file;
      continue;
    }
    if (kept.length >= MAX_FILES) {
      skipped.push({ name: file.name, reason: OVER_LIMIT_REASON });
      continue;
    }
    seen.set(key, kept.length);
    kept.push(file);
  }
  return { kept, skipped };
}

/** Split `items` into consecutive groups of at most `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Run `fn` over `items` with at most `limit` in flight, preserving input order
 * in the results. Bounded on purpose: firing a PUT per photo would open a
 * thousand connections and stall the browser.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await fn(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/** Human-readable byte size for the selection summary. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
