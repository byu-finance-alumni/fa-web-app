import Link from "next/link";
import { ExternalLink, Search, Plus } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import type { Alumni, AlumniPage } from "@/types/alumni";
import { Topbar } from "@/components/shell/Topbar";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";

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
  year?: string;
  archived?: string;
  offset?: string;
};

export default async function AlumniListPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  const params = new URLSearchParams({
    limit: String(LIMIT),
    offset: String(offset),
  });
  if (sp.q) params.set("q", sp.q);
  if (sp.year) params.set("graduation_year", sp.year);
  if (sp.archived === "1") params.set("include_archived", "true");

  let data: AlumniPage | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<AlumniPage>(`/alumni?${params.toString()}`);
  } catch (e) {
    error =
      e instanceof ApiError ? e : new ApiError(0, "Failed to load alumni.");
  }

  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  const pageHref = (newOffset: number) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (sp.year) p.set("year", sp.year);
    if (sp.archived === "1") p.set("archived", "1");
    if (newOffset > 0) p.set("offset", String(newOffset));
    const qs = p.toString();
    return qs ? `/alumni?${qs}` : "/alumni";
  };

  return (
    <>
      <Topbar title="Alumni" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex justify-end">
          <Link
            href="/alumni/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500"
          >
            <Plus className="h-4 w-4" /> Add alumni
          </Link>
        </div>

        <form
          method="get"
          className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-3"
        >
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
            <Search className="h-4 w-4 text-gray-500" aria-hidden="true" />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search name, BYU ID, or Net ID"
              className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
            />
          </div>
          <input
            name="year"
            type="number"
            defaultValue={sp.year ?? ""}
            placeholder="Grad year"
            className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
          />
          <label className="flex items-center gap-2 px-1 text-sm text-gray-700">
            <input
              type="checkbox"
              name="archived"
              value="1"
              defaultChecked={sp.archived === "1"}
            />
            Include archived
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500"
          >
            Apply
          </button>
        </form>

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
