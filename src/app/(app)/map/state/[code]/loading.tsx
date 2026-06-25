import { Topbar } from "@/components/shell/Topbar";

/** Skeleton for the single-state map page — mirrors the real layout: a dominant
 *  map card on the left and the four-box ranking rail on the right (same as the
 *  /map view), so the loading state doesn't flash a different shape. */
export default function Loading() {
  return (
    <>
      <Topbar breadcrumb={[{ label: "Map", href: "/map" }, { label: "…" }]} />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 lg:overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-4 lg:grid-rows-1">
          {/* Map (left, dominant) */}
          <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-card lg:col-span-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
              </div>
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-gray-100" />
          </div>

          {/* Ranking rail (right) — four boxes */}
          <div className="flex min-h-0 flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="min-h-0 flex-1 animate-pulse rounded-lg border border-gray-200 bg-white shadow-card"
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
