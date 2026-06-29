import { Topbar } from "@/components/shell/Topbar";
import { MetricGridSkeleton, CardSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the Dashboard — mirrors the live two-column grid: the search bar
 *  + tabbed search card on the left, the KPI strip + the two chart panels on the
 *  right (which fill the column height). */
export default function Loading() {
  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex min-h-full flex-col gap-5 lg:h-full lg:flex-row lg:items-stretch">
          {/* LEFT — search bar, then the tabbed search card */}
          <div className="flex min-h-0 flex-1 flex-col gap-5">
            <CardSkeleton className="h-28 shrink-0" />
            <CardSkeleton className="min-h-[26rem] flex-1" />
          </div>
          {/* RIGHT — KPI strip + the two chart panels */}
          <div className="flex flex-1 flex-col gap-5">
            <MetricGridSkeleton
              count={3}
              className="grid grid-cols-1 gap-5 sm:grid-cols-3"
            />
            <CardSkeleton className="min-h-[18rem] flex-1" />
            <CardSkeleton className="min-h-[18rem] flex-1" />
          </div>
        </div>
      </main>
    </>
  );
}
