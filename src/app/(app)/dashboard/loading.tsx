import { Topbar } from "@/components/shell/Topbar";
import {
  MetricGridSkeleton,
  CardSkeleton,
  PageSpinner,
} from "@/components/shared/Skeletons";

/** Skeleton for the Dashboard — mirrors the live top-to-bottom stack: the navy
 *  welcome band, the search card, the three-across KPI strip, then the tabbed
 *  search card and the Industry breakdown panel side by side. */
export default function Loading() {
  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-auto">
        {/* The band itself is static markup on the live page (a greeting, not
            fetched data), so the skeleton draws it rather than shimmering it —
            an empty navy strip is what the user is about to see anyway. */}
        <div className="h-[6.5rem] shrink-0 bg-navy-800 md:h-[7.5rem]" />
        <div className="p-4 md:p-6">
          <PageSpinner className="md:hidden" />
          <div className="hidden flex-col gap-4 md:flex lg:gap-5">
            <CardSkeleton className="h-[6.5rem] shrink-0" />
            <MetricGridSkeleton
              count={3}
              className="hidden grid-cols-1 gap-4 sm:grid-cols-3 lg:grid"
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
              <CardSkeleton className="min-h-[26rem]" />
              <CardSkeleton className="hidden min-h-[26rem] lg:block" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
