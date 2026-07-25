import { Topbar } from "@/components/shell/Topbar";
import {
  MetricGridSkeleton,
  CardSkeleton,
  PageSpinner,
} from "@/components/shared/Skeletons";

/** Skeleton for the Dashboard — mirrors the live two-column grid: the search bar
 *  + tabbed search card on the left, the KPI strip + the single Industry
 *  breakdown panel on the right (which fills the column height). */
export default function Loading() {
  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <PageSpinner className="md:hidden" />
        <div className="hidden flex-col gap-4 md:flex lg:h-full lg:flex-row lg:items-stretch lg:gap-5">
          {/* LEFT — search bar, then the tabbed search card */}
          <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:gap-5">
            <CardSkeleton className="h-28 shrink-0" />
            <CardSkeleton className="min-h-[26rem] lg:flex-1" />
          </div>
          {/* RIGHT — KPI strip + the Industry breakdown panel filling the rest */}
          <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:gap-5">
            <MetricGridSkeleton
              count={3}
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            />
            <CardSkeleton className="min-h-[18rem] lg:flex-1" />
          </div>
        </div>
      </main>
    </>
  );
}
