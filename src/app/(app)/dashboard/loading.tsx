import { Topbar } from "@/components/shell/Topbar";
import {
  MetricGridSkeleton,
  CardSkeleton,
  PageSpinner,
} from "@/components/shared/Skeletons";

/** Skeleton for the Dashboard — mirrors the live top-to-bottom stack: the
 *  welcome heading, the search card, the three-across KPI strip, then the
 *  tabbed search card and the Industry breakdown panel side by side on the same
 *  5:7 split. The page is white top to bottom, like the live one. */
export default function Loading() {
  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-auto">
        {/* The heading is static markup on the live page (a greeting, not
            fetched data), so the skeleton reserves its exact height rather than
            shimmering it — the block below must not jump when it resolves. */}
        <div className="shrink-0 px-4 pt-6 md:px-6 md:pt-7">
          <div className="h-9 w-72 animate-pulse rounded-md bg-gray-100 md:h-10" />
          <div className="mt-2 h-6 w-[28rem] max-w-full animate-pulse rounded-md bg-gray-100" />
        </div>
        <div className="p-4 md:p-6">
          <PageSpinner className="md:hidden" />
          <div className="hidden flex-col gap-4 md:flex lg:gap-5">
            <CardSkeleton className="h-[7.5rem] shrink-0" />
            <MetricGridSkeleton
              count={3}
              className="hidden grid-cols-1 gap-4 sm:grid-cols-3 lg:grid lg:gap-5"
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
              <CardSkeleton className="min-h-[26rem] lg:col-span-5" />
              <CardSkeleton className="hidden min-h-[26rem] lg:col-span-7 lg:block" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
