import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import type { Alumni, AlumniPage } from "@/types/alumni";
import type { GeoSummary } from "@/types/geography";
import { Topbar } from "@/components/shell/Topbar";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { AlumniFilters } from "@/components/alumni/AlumniFilters";

const LIMIT = 25;

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

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {label}
    </span>
  );
}

type SP = {
  q?: string;
  /** Grad-year range (inclusive). */
  ymin?: string;
  ymax?: string;
  employer?: string;
  industry?: string;
  attended?: string;
  donor?: string;
  mentor?: string;
  speaker?: string;
  archived?: string;
  /** "1" = only deceased, "0" = exclude deceased, absent = any. */
  deceased?: string;
  missing_email?: string;
  missing_employer?: string;
  duplicate?: string;
  offset?: string;
  /** Legacy deep-link params (pre-filter-menu), still honored. */
  year?: string;
  missing?: string;
};

export default async function AlumniListPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  // Normalize (incl. legacy ?year= / ?missing= deep links) into one model.
  const filters = {
    q: sp.q ?? "",
    ymin: sp.ymin ?? sp.year ?? "",
    ymax: sp.ymax ?? sp.year ?? "",
    employer: sp.employer ?? "",
    industry: sp.industry ?? "",
    attended: sp.attended === "1",
    donor: sp.donor === "1",
    mentor: sp.mentor === "1",
    speaker: sp.speaker === "1",
    archived: sp.archived === "1",
    deceased: (sp.deceased === "1"
      ? "only"
      : sp.deceased === "0"
        ? "exclude"
        : "") as "" | "only" | "exclude",
    missingEmail: sp.missing_email === "1" || sp.missing === "email",
    missingEmployer: sp.missing_employer === "1" || sp.missing === "employer",
    duplicate: sp.duplicate === "1",
  };

  const params = new URLSearchParams({
    limit: String(LIMIT),
    offset: String(offset),
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.ymin) params.set("grad_year_min", filters.ymin);
  if (filters.ymax) params.set("grad_year_max", filters.ymax);
  if (filters.employer) params.set("employer", filters.employer);
  if (filters.industry) params.set("industry", filters.industry);
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

  let data: AlumniPage | null = null;
  let error: ApiError | null = null;
  let options: GeoSummary["options"] | null = null;
  // Fetch the list and the filter-menu options (distinct employers /
  // industries) concurrently; the options are non-critical, so a failure
  // there just leaves the dropdowns with "All".
  const [listResult, optionsResult] = await Promise.allSettled([
    apiGet<AlumniPage>(`/alumni?${params.toString()}`),
    apiGet<GeoSummary>("/geography/summary"),
  ]);
  if (listResult.status === "fulfilled") {
    data = listResult.value;
  } else {
    const e = listResult.reason;
    error =
      e instanceof ApiError ? e : new ApiError(0, "Failed to load alumni.");
  }
  if (optionsResult.status === "fulfilled") {
    options = optionsResult.value.options;
  }

  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  const pageHref = (newOffset: number) => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.ymin) p.set("ymin", filters.ymin);
    if (filters.ymax) p.set("ymax", filters.ymax);
    if (filters.employer) p.set("employer", filters.employer);
    if (filters.industry) p.set("industry", filters.industry);
    if (filters.attended) p.set("attended", "1");
    if (filters.donor) p.set("donor", "1");
    if (filters.mentor) p.set("mentor", "1");
    if (filters.speaker) p.set("speaker", "1");
    if (filters.archived) p.set("archived", "1");
    if (filters.deceased === "only") p.set("deceased", "1");
    if (filters.deceased === "exclude") p.set("deceased", "0");
    if (filters.missingEmail) p.set("missing_email", "1");
    if (filters.missingEmployer) p.set("missing_employer", "1");
    if (filters.duplicate) p.set("duplicate", "1");
    if (newOffset > 0) p.set("offset", String(newOffset));
    const qs = p.toString();
    return qs ? `/alumni?${qs}` : "/alumni";
  };

  return (
    <>
      <Topbar title="Alumni" />
      <main className="flex-1 overflow-auto p-6">
        <AlumniFilters
          initial={filters}
          employers={options?.employers ?? []}
          industries={options?.industries ?? []}
        />

        {error ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">
              {error.status === 403
                ? "Your account isn't provisioned yet"
                : error.status === 401
                  ? "Please sign in again"
                  : "Couldn't load alumni"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {error.status === 403
                ? "Ask a Super Admin to grant your account a role."
                : error.message}
            </p>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No alumni match your search.
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards (dense tables collapse, never h-scroll) */}
            <div className="space-y-2 md:hidden">
              {data!.items.map((a) => (
                <Link
                  key={a.alumni_id}
                  href={`/alumni/${a.alumni_id}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white p-3"
                >
                  <InitialsAvatar name={avatarName(a)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {fullName(a)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {[
                        a.graduation_year ? `Class of ${a.graduation_year}` : null,
                        a.byu_id,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  {a.archived ? (
                    <Chip label="Archived" />
                  ) : a.deceased ? (
                    <Chip label="Deceased" />
                  ) : null}
                </Link>
              ))}
            </div>

            {/* Desktop: dense table */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-300 bg-white md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="w-24 px-4 py-3">Grad</th>
                    <th className="w-40 px-4 py-3">BYU ID</th>
                    <th className="w-36 px-4 py-3">Status</th>
                    <th className="w-24 px-4 py-3">LinkedIn</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((a) => (
                    <tr
                      key={a.alumni_id}
                      className="border-b border-gray-300 last:border-0 hover:bg-brand-blue-50/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={avatarName(a)} size="sm" />
                          <Link
                            href={`/alumni/${a.alumni_id}`}
                            className="font-medium text-gray-900 hover:text-brand-blue-600"
                          >
                            {fullName(a)}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">
                        {a.graduation_year ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {a.byu_id ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {a.archived ? (
                          <Chip label="Archived" />
                        ) : a.deceased ? (
                          <Chip label="Deceased" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {a.linkedin_url ? (
                          <a
                            href={a.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-brand-blue-600 hover:underline"
                          >
                            View <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
  const cls =
    "rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium";
  return enabled ? (
    <Link href={href} className={`${cls} bg-white text-gray-700 hover:bg-gray-50`}>
      {label}
    </Link>
  ) : (
    <span className={`${cls} bg-gray-50 text-gray-300`}>{label}</span>
  );
}
