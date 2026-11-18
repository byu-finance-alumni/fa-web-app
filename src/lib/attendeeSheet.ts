/**
 * Pure helpers for the attendee spreadsheet confirm screen (api#693).
 *
 * The preview gives every row a suggested choice; the reviewer may change the
 * choice (another candidate, new alum, new friend, skip) and edit the row's
 * values. {@link toCommitRows} turns that into the exact commit body. Nothing
 * is saved until the commit is sent — the server writes nothing on preview.
 */

import type {
  SheetAction,
  SheetCandidate,
  SheetCommitRow,
  SheetPreviewRow,
  SheetStatus,
} from "@/types/attendee-sheet";

/** The editable values of one row. Years are strings while being typed. */
export interface SheetDraft {
  action: SheetAction;
  alumni_id: number | null;
  first_name: string;
  last_name: string;
  company: string;
  role: string;
  email: string;
  linkedin: string;
  ug_year: string;
  grad_year: string;
  net_id: string;
}

export function draftFromRow(row: SheetPreviewRow): SheetDraft {
  return {
    action: row.action,
    alumni_id: row.alumni_id ?? null,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    company: row.company ?? "",
    role: row.role ?? "",
    email: row.email ?? "",
    linkedin: row.linkedin ?? "",
    ug_year: row.ug_year != null ? String(row.ug_year) : "",
    grad_year: row.grad_year != null ? String(row.grad_year) : "",
    net_id: row.net_id ?? "",
  };
}

/** The `<select>` value for a draft's choice. */
export function choiceValue(d: Pick<SheetDraft, "action" | "alumni_id">): string {
  if (d.action === "match") return d.alumni_id != null ? `match:${d.alumni_id}` : "";
  return d.action;
}

/** Apply a `<select>` value back onto a draft. */
export function applyChoice(d: SheetDraft, value: string): SheetDraft {
  if (value.startsWith("match:")) {
    const id = Number(value.slice("match:".length));
    return { ...d, action: "match", alumni_id: Number.isFinite(id) ? id : null };
  }
  if (value === "new_alumni" || value === "new_friend" || value === "skip") {
    return { ...d, action: value, alumni_id: null };
  }
  return { ...d, action: "match", alumni_id: null };
}

export function candidateLabel(c: SheetCandidate): string {
  const years = [c.graduation_year, c.graduate_graduation_year]
    .filter((y): y is number => y != null)
    .join(" / ");
  const bits = [
    years || null,
    c.current_employer || null,
    c.is_alumni ? null : (c.friend_id ?? "Friend"),
  ].filter(Boolean);
  return bits.length ? `${c.name} (${bits.join(", ")})` : c.name;
}

const YEAR_RE = /^\d{4}$/;

function parseYear(v: string): number | null | "bad" {
  const t = v.trim();
  if (t === "") return null;
  if (!YEAR_RE.test(t)) return "bad";
  const n = Number(t);
  return n >= 1900 && n <= 2100 ? n : "bad";
}

/** Why this draft can't be saved yet, or null when it can. */
export function draftProblem(d: SheetDraft): string | null {
  if (d.action === "skip") return null;
  if (d.action === "match") return d.alumni_id == null ? "Pick a record." : null;
  if (!d.first_name.trim() || !d.last_name.trim()) return "First and last name needed.";
  if (parseYear(d.ug_year) === "bad") return "UG YR must be a 4-digit year.";
  if (parseYear(d.grad_year) === "bad") return "GradYR must be a 4-digit year.";
  if (d.net_id.trim().length > 12) return "Net ID is too long.";
  return null;
}

const blank = (v: string): string | null => (v.trim() === "" ? null : v.trim());

/** The commit body row for one draft. Match/skip rows carry only the choice. */
export function toCommitRow(row: number, d: SheetDraft): SheetCommitRow {
  const base: SheetCommitRow = {
    row,
    action: d.action,
    alumni_id: null,
    first_name: null,
    last_name: null,
    company: null,
    role: null,
    email: null,
    linkedin: null,
    ug_year: null,
    grad_year: null,
    net_id: null,
  };
  if (d.action === "skip") return base;
  if (d.action === "match") return { ...base, alumni_id: d.alumni_id };
  const year = (v: string) => {
    const y = parseYear(v);
    return y === "bad" ? null : y;
  };
  return {
    ...base,
    first_name: blank(d.first_name),
    last_name: blank(d.last_name),
    company: blank(d.company),
    role: blank(d.role),
    email: blank(d.email),
    linkedin: blank(d.linkedin),
    ug_year: year(d.ug_year),
    grad_year: year(d.grad_year),
    net_id: blank(d.net_id),
  };
}

export function toCommitRows(
  rows: SheetPreviewRow[],
  drafts: Record<number, SheetDraft>,
): SheetCommitRow[] {
  return rows.map((r) => toCommitRow(r.row, drafts[r.row] ?? draftFromRow(r)));
}

/** How many rows of each choice the confirm will send. */
export function choiceCounts(drafts: SheetDraft[]): Record<SheetAction, number> {
  const out: Record<SheetAction, number> = {
    match: 0,
    new_alumni: 0,
    new_friend: 0,
    skip: 0,
  };
  for (const d of drafts) out[d.action] += 1;
  return out;
}

export const STATUS_LABEL: Record<SheetStatus, string> = {
  matched: "Matched",
  ambiguous: "Pick a match",
  new_alumni: "New alum",
  new_friend: "New friend",
  already_attending: "Already attending",
  invalid: "Missing name",
};
