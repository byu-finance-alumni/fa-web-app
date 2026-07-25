import { Topbar } from "@/components/shell/Topbar";
import {
  MetricGridSkeleton,
  CardSkeleton,
  PageSpinner,
} from "@/components/shared/Skeletons";

/** Loading state for an alumni profile. Mobile shows a simple spinner; desktop
 *  shows the header card, 6-tile KPI strip, two-column body, and activity-feed
 *  skeleton mirroring the live layout. */
export default function Loading() {
  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Alumni", href: "/alumni" }, { label: "…" }]}
      />
      <main className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-6">
        <PageSpinner className="md:hidden" />
        <div className="mx-auto hidden max-w-6xl space-y-4 md:block">
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
