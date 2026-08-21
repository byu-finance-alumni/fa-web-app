import {
  HeroBand,
  HERO_OVERLAP_CLASS,
} from "@/components/dashboard/DashboardHero";
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
 * at each breakpoint, the bounded flex column, the 5:7 split. A skeleton that is
 * merely *similar* is worse than none: the layout settles, then jumps when the
 * data arrives, and the jump is blamed on the data.
 *
 * Three things are deliberately REAL and not shimmered:
 *
 *   * the hero band, because the photo and the scrim are static markup — so
 *     rendering `HeroBand` is cheaper than faking it AND removes any chance of
 *     the block below moving when the greeting resolves;
 *   * Sign out, because it is a live control that works before the data does,
 *     and shimmering it would make the page look signed-out while it loads;
 *   * the band's height, which the overlap class measures the KPI strip against.
 *
 * Only the two text lines shimmer, because they depend on the signed-in user's
 * name. There is no top bar, on this page or the live one.
 */
export default function Loading() {
  return (
    <main className="flex-1 overflow-auto lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:[scrollbar-gutter:auto]">
      <HeroBand>
        {/* Same heights as the live heading + subtitle, so the text does not
            reflow when it arrives. White at low alpha reads as a placeholder on
            the navy scrim where the page's grey shimmer would not. */}
        <div className="h-8 w-72 animate-pulse rounded-md bg-white/25 md:h-9" />
        <div className="mt-1 h-5 w-[28rem] max-w-full animate-pulse rounded-md bg-white/15" />
      </HeroBand>
      <div className="px-4 pb-4 md:px-6 md:pb-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <PageSpinner className="md:hidden" />
        <div className="hidden flex-col gap-4 pt-4 md:flex md:pt-6 lg:min-h-0 lg:flex-1 lg:gap-4 lg:pt-0">
          {/* FOUR tiles, 2x2 at tablet and 4-up from lg — the live strip's
              breakpoints exactly. `count` and the column classes have to move
              together; that pairing is what the kpi-strip test guards. */}
          <MetricGridSkeleton
            count={4}
            className={`relative hidden grid-cols-1 gap-4 sm:grid-cols-2 lg:grid lg:grid-cols-4 lg:gap-4 ${HERO_OVERLAP_CLASS}`}
          />
          <CardSkeleton className="h-[7.5rem] shrink-0" />
          {/* The row that absorbs the leftover height, like the live one. The
              panels take their height FROM it rather than declaring a min —
              a `min-h-[26rem]` here would out-vote the bound and put the
              skeleton back under the fold that the live page no longer has. */}
          <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:gap-5">
            <CardSkeleton className="min-h-[26rem] lg:col-span-5 lg:min-h-0" />
            <CardSkeleton className="hidden lg:col-span-7 lg:block lg:min-h-0" />
          </div>
        </div>
      </div>
    </main>
  );
}
