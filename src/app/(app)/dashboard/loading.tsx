import { Topbar } from "@/components/shell/Topbar";
import {
  HeroBand,
  HERO_OVERLAP_CLASS,
} from "@/components/dashboard/DashboardHero";
import {
  MetricGridSkeleton,
  CardSkeleton,
  PageSpinner,
} from "@/components/shared/Skeletons";

/** Skeleton for the Dashboard — mirrors the live top-to-bottom stack: the hero
 *  band, the three-across KPI strip straddling its bottom edge, the search card,
 *  then the tabbed search card and the Industry breakdown panel side by side on
 *  the same 5:7 split.
 *
 *  The band itself is REAL, not a shimmer: the photo and the scrim are static
 *  markup, so rendering the actual `HeroBand` is both cheaper than faking it and
 *  the only way the block below can't jump when the data resolves. Only the two
 *  text lines, which depend on the signed-in user's name, are shimmered. The top
 *  bar carries no title here for the same reason it doesn't on the live page. */
export default function Loading() {
  return (
    <>
      <Topbar />
      <main className="flex-1 overflow-auto">
        <HeroBand>
          {/* Same heights as the live heading + subtitle, so the text does not
              reflow when it arrives. White at low alpha reads as a placeholder
              on the navy scrim where the page's grey shimmer would not. */}
          <div className="h-9 w-72 animate-pulse rounded-md bg-white/25 md:h-10" />
          <div className="mt-2 h-6 w-[28rem] max-w-full animate-pulse rounded-md bg-white/15" />
        </HeroBand>
        <div className="px-4 pb-4 md:px-6 md:pb-6">
          <PageSpinner className="md:hidden" />
          <div className="hidden flex-col gap-4 pt-4 md:flex md:pt-6 lg:gap-5 lg:pt-0">
            <MetricGridSkeleton
              count={3}
              className={`relative hidden grid-cols-1 gap-4 sm:grid-cols-3 lg:grid lg:gap-5 ${HERO_OVERLAP_CLASS}`}
            />
            <CardSkeleton className="h-[7.5rem] shrink-0" />
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
