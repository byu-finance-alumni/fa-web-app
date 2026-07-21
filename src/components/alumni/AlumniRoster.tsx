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

/**
 * How the backend interpreted a plain-English location search (#358). Optional
 * envelope field on `GET /alumni`: `label` is the resolved place ("Los Angeles,
 * CA"), `radius_miles` the applied radius, `resolved` whether geocoding
 * succeeded. All optional so the UI degrades gracefully before the backend
 * ships it.
 */
type LocationContext = {
  label?: string | null;
  radius_miles?: number | null;
  resolved?: boolean | null;
};

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

const SORT_VALUES = [
  "grad_desc",
  "grad_asc",
  "industry",
  "city",
  "state",
  "employer",
  "gender",
  "updated",
] as const;

function parseSort(raw: string): AlumniFilterState["sort"] {
  return (SORT_VALUES as readonly string[]).includes(raw)
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
    designations: arr(sp.designations),
    gender:
      one(sp.gender).toUpperCase() === "F"
        ? "F"
        : one(sp.gender).toUpperCase() === "M"
          ? "M"
          : "",
    industryGroup:
      one(sp.industry_group).toLowerCase() === "other"
        ? "other"
        : one(sp.industry_group).toLowerCase() === "unknown"
          ? "unknown"
          : "",
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
  // Designations (#404): repeated param; backend applies OR semantics and 422s
  // any value outside CFP|CFA|CPA. The UI only emits those three, so uppercase
  // values flow straight through.
  appendAll("designations", filters.designations);
  if (filters.gender) params.set("gender", filters.gender);
  if (filters.industryGroup) params.set("industry_group", filters.industryGroup);
  // Plain-English location search (#358): the backend geocodes `near` and does
  // the radius filter; `radius` (miles) is optional and only sent when parsed.
  const near = one(sp.near).trim();
  if (near) params.set("near", near);
  const radius = one(sp.radius).trim();
  if (/^\d{1,4}$/.test(radius)) params.set("radius", radius);
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

  // Row headshots (#398). The headshot bucket is private, so each photo needs its
  // own short-lived signed URL — the SAME GET /alumni/{id}/headshot the profile
  // header uses. Mint them server-side for just the visible page (≤LIMIT rows) in
  // parallel; any failure or missing/absent-net_id photo resolves to null and the
  // table falls back to the initials avatar. Keyed by alumni_id.
  const headshotUrls: Record<number, string | null> = {};
  if (data && data.items.length > 0) {
    const photoResults = await Promise.allSettled(
      data.items.map((a) =>
        apiGet<{ url: string | null }>(`/alumni/${a.alumni_id}/headshot`),
      ),
    );
    data.items.forEach((a, i) => {
      const r = photoResults[i];
      headshotUrls[a.alumni_id] =
        r.status === "fulfilled" ? (r.value?.url ?? null) : null;
    });
  }

  // Location-search interpretation (#358). The backend geocodes `near` and may
  // echo how it read the query on the page envelope. Read it defensively so the
  // banner lights up once the backend adds it and stays silent until then.
  const locationCtx =
    (data as (AlumniPage & { location?: LocationContext }) | null)?.location ??
    null;
  const locationLabel = locationCtx?.label?.trim() || "";
  const locationRadius =
    typeof locationCtx?.radius_miles === "number" ? locationCtx.radius_miles : null;
  const locationUnresolved =
    !!near && !locationLabel && locationCtx?.resolved === false;

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

        {locationLabel ? (
          <div className="mb-3 rounded-lg border border-brand-blue-300 bg-brand-blue-50 px-4 py-2.5 text-sm text-gray-700">
            Showing {noun} near{" "}
            <span className="font-semibold text-gray-900">{locationLabel}</span>
            {locationRadius ? ` (within ${locationRadius} mi)` : ""}
          </div>
        ) : locationUnresolved ? (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
            Couldn&apos;t pinpoint a location for{" "}
            <span className="font-semibold text-gray-900">
              &ldquo;{near}&rdquo;
            </span>
            . Showing keyword matches instead.
          </div>
        ) : null}

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
                  href={`${basePath}/${a.alumni_id}`}
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
              headshotUrls={headshotUrls}
              sort={filters.sort}
              basePath={basePath}
              sp={sp}
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
