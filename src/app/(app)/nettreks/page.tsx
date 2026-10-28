import { LoadError } from "@/components/shared/LoadError";
import { NetTrekReportLinks } from "@/components/nettreks/NetTrekReportLinks";
import { Topbar } from "@/components/shell/Topbar";
import { ApiError, apiGet } from "@/lib/api";
import type { NetTrekSummary } from "@/lib/nettreks";

/**
 * NetTreks tab (#887) — Amy's per-area NetTrek reports.
 *
 * Every report link with its count, one row per area. The nav entry is gated
 * on `alumni.export`, and so is `GET /nettreks`: someone who reaches this URL
 * without it gets the backend's 403 rendered as the shared error card, never a
 * guessed page. The backend decides who is on each list.
 */
export default async function NetTreksPage() {
  let data: NetTrekSummary | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<NetTrekSummary>("/nettreks");
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load NetTreks.");
  }

  return (
    <>
      <Topbar title="NetTreks" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              NetTreks
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Location means where someone works: the city on their current
              job, not where they live.
            </p>
          </div>

          {error ? (
            <LoadError status={error.status} noun="the NetTrek reports" />
          ) : (
            <NetTrekReportLinks areas={data!.areas} />
          )}
        </div>
      </main>
    </>
  );
}
