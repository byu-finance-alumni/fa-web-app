"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { RowAvatar } from "@/components/shared/RowAvatar";
import { AlumniRowActions } from "@/components/alumni/AlumniRowActions";
import { abbreviateState } from "@/lib/usStates";
import type { Alumni } from "@/types/alumni";

function fullName(a: Alumni): string {
  const last = a.last_name ?? "";
  const first = a.preferred_first_name ?? a.first_name ?? "";
  return last && first ? `${last}, ${first}` : last || first || "—";
}

function avatarName(a: Alumni): string {
  return (
    [a.preferred_first_name ?? a.first_name, a.last_name]
      .filter(Boolean)
      .join(" ") || "?"
  );
}

/**
 * Current city / state for a list row (#217). The list endpoint joins these from
 * the alumnus's current employment / contact info, but they aren't on the
 * generated `AlumniListItem` schema yet (backend follow-up — see report). Read
 * them defensively so the columns light up automatically once the backend adds
 * `current_city` / `current_state` to the list payload, and render "—" until
 * then instead of crashing.
 */
function currentLocation(a: Alumni): { city: string | null; state: string | null } {
  const row = a as Alumni & {
    current_city?: string | null;
    current_state?: string | null;
  };
  return { city: row.current_city ?? null, state: row.current_state ?? null };
}

/**
 * Compact gender label for a list row (#359). The stored value comes from the
 * import (free-text), so normalize the common spellings to a single letter:
 * "Male"/"male"/"M" → "M", "Female"/"F" → "F". Anything else (blank/unknown)
 * yields "" so the cell renders an em-dash instead of a stray value.
 */
function genderLabel(value: string | null | undefined): string {
  if (!value) return "";
  const c = value.trim()[0]?.toUpperCase();
  return c === "M" || c === "F" ? c : "";
}

/**
 * "Last Updated" label for a list row (#398): the month + year the record last
 * changed, from `updated_at` (a required, non-null date-time on the list item).
 * Formatted "Mon YYYY" (e.g. "Jul 2026"), matching the app's other short-date
 * cells. Read defensively so a missing/blank/invalid value degrades to "" (the
 * cell then renders an em-dash) instead of "Invalid Date" — if the backend ever
 * drops `updated_at` from the list payload the column simply shows "—".
 */
function lastUpdatedLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Desktop alumni table. The entire row is clickable (navigates to the
 *  profile); the name stays a real link for keyboard/focus, and the LinkedIn
 *  link stops propagation so it opens externally instead of the profile. */
export function AlumniTable({
  items,
  canEdit = false,
  canAdd = false,
  headshotUrls,
}: {
  items: Alumni[];
  /** Role gates threaded from the server page — drive the per-row action menu's
   *  Edit (`canEditAlumni`) and Add-interaction (`canAddInteraction`) items so
   *  the table never offers an action the backend would reject. */
  canEdit?: boolean;
  canAdd?: boolean;
  /** Signed headshot URLs keyed by `alumni_id`, minted server-side for the
   *  visible page (the headshot bucket is private). A missing/null entry renders
   *  the initials fallback. */
  headshotUrls?: Record<number, string | null>;
}) {
  const router = useRouter();
  const showActions = canEdit || canAdd;
  return (
    <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card md:block">
      {/* Fixed column layout (#268): widths are pinned on the header so sorting
          only reorders rows — column positions/widths never shift with the
          content. `table-fixed` ignores cell content for sizing, so long values
          truncate inside their column instead of stretching it. */}
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="sticky top-0 z-10 w-[24%] bg-gray-50 px-4 py-2.5">
              Name
            </th>
            <th className="sticky top-0 z-10 w-20 bg-gray-50 px-4 py-2.5 text-right">
              Grad
            </th>
            <th className="sticky top-0 z-10 w-16 bg-gray-50 px-4 py-2.5">
              Gender
            </th>
            <th className="sticky top-0 z-10 w-[20%] bg-gray-50 px-4 py-2.5">
              Current company
            </th>
            <th className="sticky top-0 z-10 w-[18%] bg-gray-50 px-4 py-2.5">
              Current industry
            </th>
            <th className="sticky top-0 z-10 w-[12%] bg-gray-50 px-4 py-2.5">
              City
            </th>
            <th className="sticky top-0 z-10 w-16 bg-gray-50 px-4 py-2.5">
              State
            </th>
            <th className="sticky top-0 z-10 w-28 bg-gray-50 px-4 py-2.5">
              Last Updated
            </th>
            <th className="sticky top-0 z-10 w-24 bg-gray-50 px-4 py-2.5">
              LinkedIn
            </th>
            {showActions ? (
              <th className="sticky top-0 z-10 w-12 bg-gray-50 px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr
              key={a.alumni_id}
              onClick={() => router.push(`/alumni/${a.alumni_id}`)}
              className="group cursor-pointer border-b border-gray-200 last:border-0 even:bg-gray-50/50 hover:bg-gray-50"
            >
              <td className="px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <RowAvatar
                    url={headshotUrls?.[a.alumni_id] ?? null}
                    name={avatarName(a)}
                  />
                  <Link
                    href={`/alumni/${a.alumni_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="truncate font-medium text-gray-900 group-hover:text-brand-blue-600"
                  >
                    {fullName(a)}
                  </Link>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                {a.graduation_year ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-gray-700">
                {genderLabel(a.gender) || (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="truncate px-4 py-2.5 text-gray-700">
                {a.current_employer ?? (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="truncate px-4 py-2.5 text-gray-700">
                {/* For "Other" alumni, show their secondary (non-finance)
                    industry instead of just "Other" (Tanya, 2026-07-11). */}
                {(a.current_industry?.toLowerCase() === "other" &&
                a.current_industry_secondary
                  ? a.current_industry_secondary
                  : a.current_industry) ?? (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              {(() => {
                const { city, state } = currentLocation(a);
                return (
                  <>
                    <td className="truncate px-4 py-2.5 text-gray-700">
                      {city ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="truncate px-4 py-2.5 text-gray-700">
                      {abbreviateState(state) || (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </>
                );
              })()}
              <td className="truncate px-4 py-2.5 tabular-nums text-gray-700">
                {lastUpdatedLabel(a.updated_at) || (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                {a.linkedin_url ? (
                  <a
                    href={a.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Open LinkedIn profile"
                    title="Open LinkedIn profile"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-blue-600 transition-colors hover:bg-brand-blue-50"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              {showActions ? (
                <td className="px-4 py-2.5">
                  <AlumniRowActions
                    alumniId={a.alumni_id}
                    canEdit={canEdit}
                    canAdd={canAdd}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
