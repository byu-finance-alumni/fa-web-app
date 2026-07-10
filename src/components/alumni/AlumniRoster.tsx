import Link from "next/link";
import { apiGet, apiGetWithRetry, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import type { Alumni, AlumniPage } from "@/types/alumni";
import type { FilterOptions } from "@/types/filters";
import { hasFullAccess, canEditAlumni, canAddInteraction } from "@/constants/roles";
import { Topbar } from "@/components/shell/Topbar";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { AlumniFilters, type AlumniFilterState } from "@/components/alumni/AlumniFilters";
import { AlumniTable } from "@/components/alumni/AlumniTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LIMIT = 25;

/** Roster scope. `alumni` = /alumni (is_alumni=true), `friend` = /friends
 *  (is_alumni=false). Each is its own route with its own basePath; the scope is
 *  fixed by the route, not a URL query param. */
export type RosterKind = "alumni" | "friend";

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

/** Truthy boolean URL param: accepts "1" or "true" (case-insensitive). */
const isTrue = (v: string | string[] | undefined): boolean => {
  const s = one(v).toLowerCase();
  return s === "1" || s === "true";
};

const GRAD_SORTS = ["grad_desc", "grad_asc"] as const;

function parseSort(raw: string): AlumniFilterState["sort"] {
  return (GRAD_SORTS as readonly string[]).includes(raw)
    ? (raw as AlumniFilterState["sort"])
    : "name";
}

/**
 * The shared alumni/friends roster (list). `/alumni` and `/friends` render this
 * with a fixed `kind` + `basePath`; the friends route sends `kind=friend` to the
 * backend so its list is the non-alumni contacts only — never mixed with alumni.
 */
export async function AlumniRoster({
  sp,
  kind,
  basePath,
}: {
  sp: SP;
  kind: RosterKind;
  basePath: string;
}) {
  const isFriend = kind === "friend";
  const noun = isFriend ? "friends" : "alumni";
  const offset = Math.max(0, Number(one(sp.offset) || "0") || 0);

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
    neverContacted: isTrue(sp.never_contacted),
    attended: isTrue(sp.attended),
    donor: isTrue(sp.donor),
    mentor: isTrue(sp.mentor),
    speaker: isTrue(sp.speaker),
    cfa: isTrue(sp.cfa),
    cpa: isTrue(sp.cpa),
    graduateDegree: isTrue(sp.graduate_degree),
    archived: isTrue(sp.archived),
    deceased: isTrue(sp.deceased)
      ? "only"
      : one(sp.deceased) === "0" || one(sp.deceased).toLowerCase() === "false"
        ? "exclude"
        : "",
    missingEmail: isTrue(sp.missing_email) || one(sp.missing) === "email",
    missingEmployer:
      isTrue(sp.missing_employer) || one(sp.missing) === "employer",
    duplicate: isTrue(sp.duplicate),
    needsSurvey: false,
    sort: parseSort(one(sp.sort)),
  };

  const params = new URLSearchParams({
    limit: String(LIMIT),
    offset: String(offset),
  });
  // The route fixes the roster scope. `alumni` is the backend default, so only
  // the friends route sends the param.
  if (isFriend) params.set("kind", "friend");
  if (filters.q) params.set("q", filters.q);
  if (filters.ymin) params.set("grad_year_min", filters.ymin);
  if (filters.ymax) params.set("grad_year_max", filters.ymax);
  const appendAll = (name: string, values: string[]) => {
    for (const v of values) params.append(name, v);
  };
  appendAll("employer", arr(sp.employer));
  for (const field of [
    "net_id",
    "first_name",
    "last_name",
    "preferred_name",
    "email",
  ] as const) {
    const v = one(sp[field]).trim();
    if (v) params.set(field, v);
  }
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
  if (filters.contactedAfter) params.set("contacted_after", filters.contactedAfter);
  if (filters.contactedBefore) params.set("contacted_before", filters.contactedBefore);
  if (filters.neverContacted) params.set("never_contacted", "true");
  if (filters.attended) params.set("attended_event", "true");
  if (filters.donor) params.set("donor", "true");
  if (filters.mentor) params.set("mentor_willing", "true");
  if (filters.speaker) params.set("guest_speaker_willing", "true");
  if (filters.cfa) params.set("cfa", "true");
  if (filters.cpa) params.set("cpa", "true");
  if (filters.graduateDegree) params.set("graduate_degree", "true");
  const isoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const spokeAfter = one(sp.spoke_after);
  const spokeBefore = one(sp.spoke_before);
  if (isoDate(spokeAfter)) params.set("spoke_after", spokeAfter);
  if (isoDate(spokeBefore)) params.set("spoke_before", spokeBefore);
  if (filters.archived) params.set("include_archived", "true");
  if (filters.deceased === "only") params.set("deceased", "true");
  if (filters.deceased === "exclude") params.set("deceased", "false");
  if (filters.missingEmail) params.set("missing_email", "true");
  if (filters.missingEmployer) params.set("missing_employer", "true");
  if (filters.duplicate) params.set("duplicate", "true");
  if (filters.sort !== "name") params.set("sort", filters.sort);

  let data: AlumniPage | null = null;
  let error: ApiError | null = null;
  let options: FilterOptions | null = null;
  const [listResult, optionsResult, industryVocabResult, ctxResult] =
    await Promise.allSettled([
      apiGetWithRetry<AlumniPage>(`/alumni?${params.toString()}`),
      apiGet<FilterOptions>("/alumni/filter-options", {
        revalidate: 300,
        tags: ["alumni-filter-options"],
      }),
      apiGet<{ category: string; values: string[] }>("/vocabulary/industry", {
        revalidate: 300,
        tags: ["vocabulary"],
      }),
      getAuthContext(),
    ]);
  if (listResult.status === "fulfilled") {
    data = listResult.value;
  } else {
    const e = listResult.reason;
    error =
      e instanceof ApiError ? e : new ApiError(0, `Failed to load ${noun}.`);
  }
  if (optionsResult.status === "fulfilled") {
    options = optionsResult.value;
  }
  if (
    options &&
    industryVocabResult.status === "fulfilled" &&
    Array.isArray(industryVocabResult.value.values)
  ) {
    options = { ...options, industries: industryVocabResult.value.values };
  }
  const roles =
    ctxResult.status === "fulfilled" ? ctxResult.value.roles : null;
  const canCreate = hasFullAccess(roles);
  const canEditRows = canEditAlumni(roles);
  const canAddInteractionRows = canAddInteraction(roles);

  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  // Preserve every active filter (incl. repeated multi-select params) on paging,
  // staying on this roster's route.
  const pageHref = (newOffset: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "offset") continue;
      for (const val of arr(v)) p.append(k, val);
    }
    if (newOffset > 0) p.set("offset", String(newOffset));
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <>
      <Topbar title={isFriend ? "Friends of the Program" : "All Alumni"} />
      <main className="flex-1 overflow-auto p-6">
        <AlumniFilters
          initial={filters}
          options={options ?? undefined}
          canCreate={canCreate}
          canExport={canCreate}
          total={data?.total ?? 0}
          basePath={basePath}
          isFriend={isFriend}
        />

        {error ? (
          <Card className="p-10 text-center">
            <p className="font-medium text-gray-900">
              {error.status === 403
                ? "Your account isn't provisioned yet"
                : error.status === 401
                  ? "Please sign in again"
                  : `Couldn't load ${noun}`}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {error.status === 403
                ? "Ask a Super Admin to grant your account a role."
                : error.message}
            </p>
          </Card>
        ) : data && data.items.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            No {noun} match your search.
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
                    <p className="truncate font-medium text-gray-900">
                      {fullName(a)}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {[
                        a.graduation_year ? `Class of ${a.graduation_year}` : null,
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
            <AlumniTable
              items={data!.items}
              canEdit={canEditRows}
              canAdd={canAddInteractionRows}
            />

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
    <Button asChild variant="secondary">
      <Link href={href}>{label}</Link>
    </Button>
  ) : (
    <Button variant="secondary" disabled>
      {label}
    </Button>
  );
}
