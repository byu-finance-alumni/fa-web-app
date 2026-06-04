import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import type { Alumni, AlumniPage } from "@/types/alumni";
import { Topbar } from "@/components/shell/Topbar";

function fullName(a: Alumni): string {
  const last = a.last_name ?? "";
  const first = a.preferred_first_name ?? a.first_name ?? "";
  return last && first ? `${last}, ${first}` : last || first || "—";
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {label}
    </span>
  );
}

export default async function AlumniListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const params = new URLSearchParams({ limit: "50" });
  if (q) params.set("q", q);

  let data: AlumniPage | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<AlumniPage>(`/alumni?${params.toString()}`);
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load alumni.");
  }

  return (
    <>
      <Topbar title="Alumni" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Alumni</h2>
          <p className="text-sm text-gray-500">
            {data ? `${data.total} records` : "Class records"}
          </p>
        </div>

        <form
          method="get"
          className="mb-4 flex items-center gap-2 rounded-xl border border-gray-300 bg-white p-3"
        >
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
            <Search className="h-4 w-4 text-gray-500" aria-hidden="true" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name, BYU ID, or Net ID"
              className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500"
          >
            Search
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
          <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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
                      <Link
                        href={`/alumni/${a.alumni_id}`}
                        className="font-medium text-gray-900 hover:text-brand-blue-600"
                      >
                        {fullName(a)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {a.graduation_year ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{a.byu_id ?? "—"}</td>
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
        )}
      </main>
    </>
  );
}
