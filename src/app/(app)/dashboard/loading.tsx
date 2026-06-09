import { Topbar } from "@/components/shell/Topbar";
import { MetricGridSkeleton, CardSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the Dashboard — KPI tiles, the employers/industries row, then
 *  the full-height map | event-participation row that fills the viewport. */
export default function Loading() {
  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6 lg:overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:overflow-hidden">
          {/* Row 1 — KPI strip (6 across, matching the live grid) */}
          <MetricGridSkeleton
            count={6}
            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"
          />
          {/* Row 2 — Top employers | Top industries */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CardSkeleton className="h-72" />
            <CardSkeleton className="h-72" />
          </div>
          {/* Row 3 — Alumni map | Event participation (fills viewport height) */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <CardSkeleton className="h-96 lg:h-auto" />
            <CardSkeleton className="h-96 lg:h-auto" />
          </div>
        </div>
      </main>
    </>
  );
}
