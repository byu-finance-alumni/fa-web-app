import { HERO_OVERLAP_CLASS } from "@/components/dashboard/DashboardHero";
import {
  MetricGridSkeleton,
  CardSkeleton,
  PageSpinner,
} from "@/components/shared/Skeletons";

/**
 * Skeleton for the Dashboard.
 *
 * ⚠️ ITS ONLY JOB IS TO BE THE SAME SHAPE AS THE LIVE PAGE. Every value here is
 * copied from `page.tsx` rather than chosen — the tile count, the column counts
 * at each breakpoint, the bounded flex column, the clip margin, the 5:7 split. A
 * skeleton that is merely *similar* is worse than none: the layout settles, then
 * jumps when the data arrives, and the jump gets blamed on the data.
 *
 * NO MASTHEAD HERE ANY MORE (experiment/top-nav). The greeting and its photo
 * moved into the shell, which renders on the server with the auth context and is
 * already on screen while this file is showing — so a `HeroBand` here painted a
 * SECOND photo under the real one for the duration of the load, then vanished.
 * The shell's header needs no placeholder because it is never absent.
 *
 * What is left is exactly the part that waits on the dashboard summary: the KPI
 * strip, the search card, and the two panels.
 */
export default function Loading() {
  return (
    <main className="flex-1 overflow-auto lg:flex lg:min-h-0 lg:flex-col lg:[overflow:clip] lg:[overflow-clip-margin:96px] lg:[scrollbar-gutter:auto]">
      <div className="px-4 pb-4 md:px-6 md:pb-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <PageSpinner className="md:hidden" />
        <div className="hidden flex-col gap-4 pt-4 md:flex md:pt-6 lg:min-h-0 lg:flex-1 lg:gap-4 lg:pt-0">
          {/* FOUR tiles, 2x2 at tablet and 4-up from lg, pulled up by the same
              overlap the live strip uses so they straddle the shell's photo
              rather than starting below it. `count` and the column classes have
              to move together; that pairing is what the kpi-strip test guards. */}
          <MetricGridSkeleton
            count={4}
            className={`relative z-10 hidden grid-cols-1 gap-4 sm:grid-cols-2 lg:grid lg:grid-cols-4 lg:gap-4 ${HERO_OVERLAP_CLASS}`}
          />
          <CardSkeleton className="h-[7.5rem] shrink-0" />
          {/* The row that absorbs the leftover height, like the live one. The
              panels take their height FROM it rather than declaring a min — a
              `min-h-[26rem]` here would out-vote the bound and put the skeleton
              back under a fold the live page does not have. */}
          <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:gap-5">
            <CardSkeleton className="min-h-[26rem] lg:col-span-5 lg:min-h-0" />
            <CardSkeleton className="hidden lg:col-span-7 lg:block lg:min-h-0" />
          </div>
        </div>
      </div>
    </main>
  );
}
