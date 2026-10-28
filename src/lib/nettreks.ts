/**
 * NetTreks tab (#887): Amy's per-area NetTrek Hosts and Area Alumni reports.
 *
 * The backend owns the areas, the radii and who is on each list — see
 * fa-web-api `app/services/nettreks.py`. This module only knows the shapes, the
 * URL scheme, and the words shown around them.
 */
import type { Schema } from "@/types/api";

export type NetTrekSummary = Schema<"NetTrekSummary">;
export type NetTrekAreaSummary = Schema<"NetTrekAreaSummary">;
export type NetTrekReportCount = Schema<"NetTrekReportCount">;
export type NetTrekReportPage = Schema<"NetTrekReportPage">;
export type NetTrekRow = Schema<"NetTrekRow">;
export type NetTrekAreaKey = Schema<"NetTrekAreaKey">;
export type NetTrekReportKind = Schema<"NetTrekReportKind">;

export const NETTREK_AREA_KEYS: readonly NetTrekAreaKey[] = [
  "dallas",
  "san_francisco",
  "los_angeles",
  "phoenix",
  "seattle",
  "washington_dc",
  "wasatch",
  "other",
];

export const NETTREK_REPORT_KINDS: readonly NetTrekReportKind[] = [
  "hosts",
  "area_alumni",
];

export const NETTREKS_PAGE_SIZE = 50;

export function isNetTrekAreaKey(value: string): value is NetTrekAreaKey {
  return (NETTREK_AREA_KEYS as readonly string[]).includes(value);
}

export function isNetTrekReportKind(value: string): value is NetTrekReportKind {
  return (NETTREK_REPORT_KINDS as readonly string[]).includes(value);
}

/** Other has only a Hosts report; every other area has both. */
export function netTrekReportExists(
  area: NetTrekAreaKey,
  kind: NetTrekReportKind,
): boolean {
  return !(area === "other" && kind === "area_alumni");
}

/** The on-screen report, optionally at a page offset. */
export function netTrekReportHref(
  area: NetTrekAreaKey,
  kind: NetTrekReportKind,
  offset = 0,
): string {
  const base = `/nettreks/${area}/${kind}`;
  return offset > 0 ? `${base}?offset=${offset}` : base;
}

/** The backend list route, one page of it. */
export function netTrekReportApiPath(
  area: NetTrekAreaKey,
  kind: NetTrekReportKind,
  offset: number,
  limit = NETTREKS_PAGE_SIZE,
): string {
  return `/nettreks/${area}/${kind}?limit=${limit}&offset=${offset}`;
}

/** The backend CSV route. */
export function netTrekExportPath(
  area: NetTrekAreaKey,
  kind: NetTrekReportKind,
): string {
  return `/nettreks/${area}/${kind}/export`;
}

/** A non-negative whole-number `?offset=`, else 0. */
export function parseNetTrekOffset(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return 0;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : 0;
}

/**
 * The name used when the backend's `Content-Disposition` is missing or unsafe.
 * Matches the backend's `<area>_nettrek_hosts_<YYYY-MM-DD>.csv` /
 * `<area>_area_alumni_<YYYY-MM-DD>.csv`, so the file is named the same either
 * way.
 */
export function netTrekExportFilename(
  area: NetTrekAreaKey,
  kind: NetTrekReportKind,
  now: Date = new Date(),
): string {
  const middle = kind === "hosts" ? "nettrek_hosts" : "area_alumni";
  return `${area}_${middle}_${now.toISOString().slice(0, 10)}.csv`;
}

/** What to tell someone whose download failed — and what to do about it. */
export function netTrekExportErrorMessage(status: number | null): string {
  if (status === 401) {
    return "Your session has expired, so the download didn’t run. Sign in again and try it once more.";
  }
  if (status === 403) {
    return "Downloading this report needs export access. Ask a Super Admin if you need it.";
  }
  if (status === 429) {
    return "Too many downloads just now, so this one didn’t run. Wait a few minutes and try again.";
  }
  return "The download didn’t run, so no file was saved. Nothing has changed. Try again in a moment.";
}

/** "Jane Q. Public" from the three name columns, skipping blanks. */
export function netTrekDisplayName(row: NetTrekRow): string {
  const name = [row.first_name, row.middle_name, row.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || "Unnamed alumnus";
}
