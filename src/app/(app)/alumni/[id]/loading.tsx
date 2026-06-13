import { Topbar } from "@/components/shell/Topbar";
import { MetricGridSkeleton, CardSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for an alumni profile — header card, the 6-tile KPI strip, the
 *  equal-length two-column body (main + sidebar), then the full-width activity
 *  feed below, mirroring the live profile layout. */
export default function Loading() {
  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Alumni", href: "/alumni" }, { label: "…" }]}
      />
      <main className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          {/* Header / name card */}
          <CardSkeleton className="h-28" />
          {/* KPI strip (6 across, matching the live grid) */}
          <MetricGridSkeleton
            count={6}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          />
          {/* Two-column body: wider main column + sidebar, equal length */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <CardSkeleton className="h-[28rem] lg:col-span-2" />
            <CardSkeleton className="h-[28rem]" />
          </div>
          {/* Activity feed (full width) */}
          <CardSkeleton className="h-72" />
        </div>
      </main>
    </>
  );
}
