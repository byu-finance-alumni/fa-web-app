import Link from "next/link";
import { apiGet, apiGetWithRetry, ApiError } from "@/lib/api";
import type { Alumni, AlumniPage, UserContext } from "@/types/alumni";
import type { FilterOptions } from "@/types/filters";
import { hasFullAccess } from "@/constants/roles";
import { Topbar } from "@/components/shell/Topbar";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlumniFilters,
  type AlumniFilterState,
} from "@/components/alumni/AlumniFilters";
import { AlumniTable } from "@/components/alumni/AlumniTable";

const LIMIT = 25;
const BASE_PATH = "/needs-surveying";

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

/** Search params: every value may arrive as a string or (for repeated multi-
 * select params) a string[]. */
type SP = Record<string, string | string[] | undefined>;

/** Normalize a search param to a clean string[] (handles single + repeated). */
const arr = (v: string | string[] | undefined): string[] =>
  v == null ? [] : (Array.isArray(v) ? v : [v]).filter(Boolean);

/** First value of a possibly-repeated param. */
const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** The grad-year sort tokens the backend GET /alumni accepts (besides "name"). */
const GRAD_SORTS = ["grad_desc", "grad_asc"] as const;

/** Normalize the ?sort= param to a recognized token; anything else → "name". */
function parseSort(raw: string): AlumniFilterState["sort"] {
  return (GRAD_SORTS as readonly string[]).includes(raw)
    ? (raw as AlumniFilterState["sort"])
    : "name";
}

/**
 * "Needs Surveying" — the biennial re-survey worklist.
 *
 * Lists alumni who are DUE for the survey (never completed one, or whose most
 * recent completion is older than 2 years). The due-set predicate is computed
 * server-side; this view simply forces `needs_survey=1` on every GET /alumni
 * request (and on exports) so the list is always scoped to the due set, while
 * the standard alumni filters can still NARROW within it.
 *
 * Admin-tier only (engineer / super_admin / full_access). The nav item is gated
 * `fullAccessOnly`, and the backend 403s the `needs_survey` param for lower
 * roles — so if a student / view_only user navigates here directly we render a
 * graceful "not authorized" state instead of crashing (mirrors Tasks).
 */
export default async function NeedsSurveyingPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(one(sp.offset) || "0") || 0);

  // Normalize the URL into state. needs_survey is route-owned (forced below),
  // never read from the URL — but it IS seeded into the filter state so the
  // export carries it.
  const filters: AlumniFilterState = {
    q: one(sp.q),
    ymin: one(sp.ymin) || one(sp.year),
    ymax: one(sp.ymax) || one(sp.year),
    pastEmployer: arr(sp.past_employer),
    industry: arr(sp.industry),
    title: arr(sp.title),
    seniority: arr(sp.seniority),
    city: arr(sp.city),
    state: arr(sp.state),
    tag: arr(sp.tag),
    statusLabel: arr(sp.status_label),
    leadership: arr(sp.leadership_role),
    surveyStatus: arr(sp.survey_status),
    contactedAfter: one(sp.contacted_after),
    contactedBefore: one(sp.contacted_before),
    neverContacted: one(sp.never_contacted) === "1",
    attended: one(sp.attended) === "1",
    donor: one(sp.donor) === "1",
    mentor: one(sp.mentor) === "1",
    speaker: one(sp.speaker) === "1",
    archived: one(sp.archived) === "1",
    deceased:
      one(sp.deceased) === "1"
        ? "only"
        : one(sp.deceased) === "0"
          ? "exclude"
          : "",
    missingEmail: one(sp.missing_email) === "1" || one(sp.missing) === "email",
    missingEmployer:
      one(sp.missing_employer) === "1" || one(sp.missing) === "employer",
    duplicate: one(sp.duplicate) === "1",
    cfa: one(sp.cfa) === "1",
    cpa: one(sp.cpa) === "1",
    // Route-owned: this view is always the due set.
    needsSurvey: true,
    sort: parseSort(one(sp.sort)),
  };

  // Backend query params. needs_survey is forced on so the list is ALWAYS the
  // biennial-due set; the other facets narrow within it.
  const params = new URLSearchParams({
    limit: String(LIMIT),
    offset: String(offset),
    needs_survey: "1",
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.ymin) params.set("grad_year_min", filters.ymin);
  if (filters.ymax) params.set("grad_year_max", filters.ymax);
  const appendAll = (name: string, values: string[]) => {
    for (const v of values) params.append(name, v);
  };
  appendAll("employer", arr(sp.employer));
  appendAll("past_employer", filters.pastEmployer);
  appendAll("industry", filters.industry);
  appendAll("title", filters.title);
  appendAll("seniority", filters.seniority);
  appendAll("city", filters.city);
  appendAll("state", filters.state);
  appendAll("tag", filters.tag);
  appendAll("status_label", filters.statusLabel);
  appendAll("leadership_role", filters.leadership);
  appendAll("survey_status", filters.surveyStatus);
  if (filters.contactedAfter)
    params.set("contacted_after", filters.contactedAfter);
  if (filters.contactedBefore)
    params.set("contacted_before", filters.contactedBefore);
  if (filters.neverContacted) params.set("never_contacted", "true");
  if (filters.attended) params.set("attended_event", "true");
  if (filters.donor) params.set("donor", "true");
  if (filters.mentor) params.set("mentor_willing", "true");
  if (filters.speaker) params.set("guest_speaker_willing", "true");
  if (filters.archived) params.set("include_archived", "true");
  if (filters.deceased === "only") params.set("deceased", "true");
  if (filters.deceased === "exclude") params.set("deceased", "false");
  if (filters.missingEmail) params.set("missing_email", "true");
  if (filters.missingEmployer) params.set("missing_employer", "true");
  if (filters.duplicate) params.set("duplicate", "true");
  if (filters.cfa) params.set("cfa", "true");
  if (filters.cpa) params.set("cpa", "true");
  if (filters.sort !== "name") params.set("sort", filters.sort);

  let data: AlumniPage | null = null;
  let error: ApiError | null = null;
  let options: FilterOptions | null = null;
  const [listResult, optionsResult, ctxResult] = await Promise.allSettled([
    apiGetWithRetry<AlumniPage>(`/alumni?${params.toString()}`),
    apiGet<FilterOptions>("/alumni/filter-options", {
      revalidate: 300,
      tags: ["alumni-filter-options"],
    }),
    apiGet<UserContext>("/auth/context"),
  ]);
  if (listResult.status === "fulfilled") {
    data = listResult.value;
  } else {
    const e = listResult.reason;
    error =
      e instanceof ApiError ? e : new ApiError(0, "Failed to load alumni.");
  }
  if (optionsResult.status === "fulfilled") {
    options = optionsResult.value;
  }
  const canExport =
    ctxResult.status === "fulfilled" && hasFullAccess(ctxResult.value.roles);

  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  // Preserve every active filter (incl. repeated multi-select params) on paging.
  const pageHref = (newOffset: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "offset") continue;
      for (const val of arr(v)) p.append(k, val);
    }
    if (newOffset > 0) p.set("offset", String(newOffset));
    const qs = p.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  };

  return (
    <>
      <Topbar title="Needs Surveying" />
      <main className="flex-1 overflow-auto p-6">
        <p className="mb-4 max-w-3xl text-sm text-gray-500">
          Alumni due for the biennial re-survey — anyone who has never completed
          a survey, or whose most recent completion is more than two years old.
          The list is always scoped to this due set; use the filters to narrow
          it further.
        </p>

        <AlumniFilters
          initial={filters}
          options={options ?? undefined}
          // No "Add alumni" affordance on this worklist — it's a re-survey view,
          // not the master roster.
          canCreate={false}
          canExport={canExport}
          total={data?.total ?? 0}
          basePath={BASE_PATH}
        />

        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "You don't have access to Needs Surveying"
                : error.status === 401
                  ? "Please sign in again"
                  : "Couldn't load alumni"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {error.status === 403
                ? "The re-survey worklist is available to full-access users only."
                : error.message}
            </p>
          </Card>
        ) : data && data.items.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            No alumni are currently due for re-survey.
          </Card>
        ) : (
          <>
            {/* Mobile: stacked cards (dense tables collapse, never h-scroll) */}
            <div className="space-y-2 md:hidden">
              {data!.items.map((a) => (
                <Link
                  key={a.alumni_id}
                  href={`/alumni/${a.alumni_id}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-card"
                >
                  <InitialsAvatar name={avatarName(a)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {fullName(a)}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {[
                        a.graduation_year
                          ? `Class of ${a.graduation_year}`
                          : null,
                        a.current_employer,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: dense table (whole row navigates to the profile) */}
            <AlumniTable items={data!.items} />

            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span>
                Showing {from}–{to} of {data!.total}
              </span>
              <div className="flex gap-2">
                <PageLink
                  href={pageHref(offset - LIMIT)}
                  enabled={hasPrev}
                  label="‹ Prev"
                />
                <PageLink
                  href={pageHref(offset + LIMIT)}
                  enabled={hasNext}
                  label="Next ›"
                />
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function PageLink({
  href,
  enabled,
  label,
}: {
  href: string;
  enabled: boolean;
  label: string;
}) {
  return enabled ? (
    <Button asChild variant="secondary" size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  ) : (
    <Button variant="secondary" size="sm" disabled aria-disabled>
      {label}
    </Button>
  );
}
