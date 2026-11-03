/**
 * Outreach interest lists: Conference Interest, Event Speakers, Event Sponsors
 * and Alumni Mentors.
 *
 * The backend owns who is on each list and what each list is called — see
 * fa-web-api `app/services/outreach_lists.py`. Every list shows the NetTrek
 * reports' people, columns and CSV, so a list's rows are `NetTrekRow`s and the
 * page reuses the NetTreks table. This module only knows the shapes, the URL
 * scheme, and the words shown around them.
 */
import type { Schema } from "@/types/api";

export type OutreachGroupKey = Schema<"OutreachGroupKey">;
export type OutreachListKey = Schema<"OutreachListKey">;
export type OutreachGroupSummary = Schema<"OutreachGroupSummary">;
export type OutreachListLink = Schema<"OutreachListLink">;
export type OutreachListPage = Schema<"OutreachListPage">;

/** The four landing pages, in Outreach-menu order, with their menu labels. */
export const OUTREACH_GROUPS: readonly { key: OutreachGroupKey; label: string }[] = [
  { key: "conference", label: "Conference Interest" },
  { key: "speakers", label: "Event Speakers" },
  { key: "sponsors", label: "Event Sponsors" },
  { key: "mentors", label: "Alumni Mentors" },
];

/** The lists each landing page has — mirrors the backend's `GROUP_LISTS`, so a
 *  URL for a list a page does not have is a 404 before any request. */
const GROUP_LISTS: Record<OutreachGroupKey, readonly OutreachListKey[]> = {
  conference: ["real_estate", "corporate_finance", "financial_services"],
  speakers: ["utah", "out_of_state"],
  sponsors: ["utah", "out_of_state"],
  mentors: ["industry", "no_industry", "women"],
};

export const OUTREACH_PAGE_SIZE = 50;

export function isOutreachGroupKey(value: string): value is OutreachGroupKey {
  return Object.prototype.hasOwnProperty.call(GROUP_LISTS, value);
}

export function isOutreachListKey(value: string): value is OutreachListKey {
  return Object.values(GROUP_LISTS).some((keys) =>
    (keys as readonly string[]).includes(value),
  );
}

/** The menu label of a landing page ("Alumni Mentors"). */
export function outreachGroupLabel(group: OutreachGroupKey): string {
  return OUTREACH_GROUPS.find((g) => g.key === group)?.label ?? "Outreach";
}

/** The landing page's URL. */
export function outreachGroupHref(group: OutreachGroupKey): string {
  return `/outreach/${group}`;
}

/** A whole-word industry, trimmed; blank is none. */
export function cleanIndustry(raw: string | string[] | undefined | null): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value : null;
}

/**
 * Whether `(group, key, industry)` is a list: the page has that list, and an
 * industry is given for (and only for) an Alumni Mentors `industry` list.
 */
export function outreachListExists(
  group: OutreachGroupKey,
  key: OutreachListKey,
  industry: string | null,
): boolean {
  if (!GROUP_LISTS[group].includes(key)) return false;
  return (key === "industry") === (industry !== null);
}

function query(params: Record<string, string | number | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null) q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** The on-screen list, optionally at a page offset. */
export function outreachListHref(
  group: OutreachGroupKey,
  key: OutreachListKey,
  industry: string | null = null,
  offset = 0,
): string {
  return `/outreach/${group}/${key}${query({
    industry,
    offset: offset > 0 ? offset : null,
  })}`;
}

/** The backend list route, one page of it. */
export function outreachListApiPath(
  group: OutreachGroupKey,
  key: OutreachListKey,
  industry: string | null,
  offset: number,
  limit = OUTREACH_PAGE_SIZE,
): string {
  return `/outreach/${group}/${key}${query({ industry, limit, offset })}`;
}

/** The backend CSV route. */
export function outreachExportPath(
  group: OutreachGroupKey,
  key: OutreachListKey,
  industry: string | null,
): string {
  return `/outreach/${group}/${key}/export${query({ industry })}`;
}

/**
 * The name used when the backend's `Content-Disposition` is missing or unsafe.
 * Matches the backend's `<group>_<key>[_<industry>]_<YYYY-MM-DD>.csv`.
 */
export function outreachExportFilename(
  group: OutreachGroupKey,
  key: OutreachListKey,
  industry: string | null,
  now: Date = new Date(),
): string {
  const parts: string[] = [group, key];
  if (industry) {
    const slug = industry
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
    parts.push(slug || "industry");
  }
  return `${parts.join("_")}_${now.toISOString().slice(0, 10)}.csv`;
}

/* ------------------------------------------------- Alumni Mentors chart -- */

/** The mentor chart only earns its place with this many mentors in all… */
export const MENTOR_CHART_MIN_MENTORS = 10;
/** …spread over at least this many industries. Below either, just the links. */
export const MENTOR_CHART_MIN_INDUSTRIES = 3;

/** The per-industry mentor links (industry + Industry Not Listed), without
 *  Alumni Mentors for Women — a separate list that overlaps them. */
export function mentorIndustryLinks(links: readonly OutreachListLink[]): OutreachListLink[] {
  return links.filter((l) => l.key === "industry" || l.key === "no_industry");
}

/**
 * Whether the Alumni Mentors page shows its per-industry bar chart: at least
 * {@link MENTOR_CHART_MIN_MENTORS} mentors in total (Industry Not Listed
 * included — they are mentors too) across at least
 * {@link MENTOR_CHART_MIN_INDUSTRIES} named industries.
 */
export function showMentorChart(links: readonly OutreachListLink[]): boolean {
  const rows = mentorIndustryLinks(links);
  const total = rows.reduce((sum, l) => sum + l.count, 0);
  const industries = rows.filter((l) => l.key === "industry" && l.count > 0).length;
  return total >= MENTOR_CHART_MIN_MENTORS && industries >= MENTOR_CHART_MIN_INDUSTRIES;
}

/** The chart's bars: one per industry (and Industry Not Listed), each linking
 *  to its list. */
export function mentorChartRows(
  links: readonly OutreachListLink[],
): { label: string; count: number; href: string }[] {
  return mentorIndustryLinks(links).map((l) => ({
    label: l.key === "industry" ? (l.industry ?? l.title) : "Industry Not Listed",
    count: l.count,
    href: outreachListHref("mentors", l.key, l.key === "industry" ? l.industry : null),
  }));
}
