import Link from "next/link";
import { apiGet, apiGetWithRetry, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import type { Alumni, AlumniPage } from "@/types/alumni";
import type { FilterOptions } from "@/types/filters";
import { canEditAlumni } from "@/constants/roles";
import {
  canAddInteraction,
  canCreateAlumni,
  canExportAlumni,
} from "@/constants/capabilities";
import { Topbar } from "@/components/shell/Topbar";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { AlumniFilters } from "@/components/alumni/AlumniFilters";
import {
  arr,
  one,
  parseAlumniFilters,
  parsePassThroughFilters,
  toAlumniPopulationParams,
  type AlumniFilterState,
} from "@/lib/alumniFilterParams";
import { AlumniTable } from "@/components/alumni/AlumniTable";
import { getHeadshotUrls } from "@/lib/headshots";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/shared/Fab";

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

  // One shared parser, inverse of the Filters panel's serializer (see
  // `@/lib/alumniFilterParams`). Parsing here and serializing there used to be
  // two hand-written lists that drifted — when they did, the panel wiped the
  // params it hadn't learned about.
  const filters: AlumniFilterState = parseAlumniFilters(sp);

  // Pass-through narrowing params (#592): `employer`, the identity fields, the
  // plain-English location search and the guest-speaker dates live only in the
  // URL — the Filters slide-over has no control for them, so touching any
  // control re-serializes its own state and drops them (see
  // `PASS_THROUGH_PARAMS`). Parsed here through the SHARED parser so the export
  // dialog sees exactly the same values this request is built from.
  const passThrough = parsePassThroughFilters(sp);

  // WHO is in this view — one definition, shared with the CSV export
  // (`toExportFilters` derives its body from these very params). The list and
  // its export used to build their populations independently and drifted twice;
  // deriving both from `toAlumniPopulationParams` is what stops a third time.
  const params = toAlumniPopulationParams(filters, kind, passThrough);
  // …and HOW this page presents them, which is the roster's own business.
  params.set("limit", String(LIMIT));
  params.set("offset", String(offset));
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
  const ctx = ctxResult.status === "fulfilled" ? ctxResult.value : null;
  const roles = ctx?.roles ?? null;
  // Creating a record and logging an interaction are separate, editable
  // capabilities (fa-web-api #379), so both read the capability list rather than
  // the role — a grant made in the permission editor takes effect here.
  const caps = ctx?.capabilities ?? null;
  const canCreate = canCreateAlumni(caps);
  // Export is its own capability (#379) — it used to ride along on the same
  // "full access" check as Add, but downloading the roster and adding a record
  // are different risks and are granted separately.
  const canExport = canExportAlumni(caps);
  const canEditRows = canEditAlumni(roles);
  const canAddInteractionRows = canAddInteraction(caps);

  // Row headshots (#398). The headshot bucket is private, so each photo needs a
  // short-lived signed URL minted server-side. This used to fan out one
  // GET /alumni/{id}/headshot PER ROW on EVERY render — 25 API invocations, 25
  // single-row queries and 25 Supabase signatures to draw one table, repeated in
  // full each time the page re-rendered. It is now one batched, cached call (see
  // `@/lib/headshots`); a missing photo, an absent net_id or any failure still
  // resolves to null and the table falls back to the initials avatar.
  const headshotUrls =
    data && data.items.length > 0
      ? await getHeadshotUrls(data.items.map((a) => a.alumni_id))
      : {};

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
    !!passThrough.near && !locationLabel && locationCtx?.resolved === false;

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
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <AlumniFilters
          initial={filters}
          options={options ?? undefined}
          canCreate={canCreate}
          canExport={canExport}
          total={data?.total ?? 0}
          basePath={basePath}
          isFriend={isFriend}
          // The export builds its population from the same two inputs this
          // request did — the filter state AND the URL-only narrowing params
          // (#592). Without the second, exporting a dashboard deep link
          // (?employer=…, ?near=…) returned people the list was excluding.
          passThrough={passThrough}
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
              &ldquo;{passThrough.near}&rdquo;
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

        {/* Mobile FAB — the create action for this roster. Desktop keeps its
            inline "Add" button in the toolbar. */}
        {canCreate ? (
          <Fab label={isFriend ? "Add friend" : "Add alumni"}>
            <Button asChild>
              <Link href={isFriend ? "/alumni/new?kind=friend" : "/alumni/new"}>
                {isFriend ? "Add friend" : "Add alumni"}
              </Link>
            </Button>
            {isFriend ? (
              <Button asChild variant="secondary">
                <Link href="/friends/import">Import CSV</Link>
              </Button>
            ) : null}
          </Fab>
        ) : null}
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
