import { Topbar } from "@/components/shell/Topbar";
import { MetricGridSkeleton, CardSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the redesigned Dashboard launchpad — two columns: search +
 *  quick filters + browse on the left, KPIs + employer/industry panels on the
 *  right (mirrors the live grid). */
export default function Loading() {
  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left column — search, quick filters, browse */}
          <div className="flex flex-col gap-4">
            <CardSkeleton className="h-20" />
            <CardSkeleton className="h-80" />
            <MetricGridSkeleton
              count={6}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            />
          </div>
          {/* Right column — KPI strip + employer/industry panels */}
          <div className="flex flex-col gap-4">
            <MetricGridSkeleton
              count={3}
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            />
            <CardSkeleton className="h-80" />
            <CardSkeleton className="h-80" />
          </div>
        </div>
      </main>
    </>
  );
}
