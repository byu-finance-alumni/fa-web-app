/**
 * Dashboard hero band — the Tanner Building atrium photo with the welcome text
 * over it, and the KPI strip straddling its bottom edge (the strip itself lives
 * in the page, pulled up with a negative margin; see `HERO_OVERLAP_PX`).
 *
 * It replaces the old plain-white welcome heading AND the shared top bar's
 * "Dashboard" title — the band is now the page's identity, so repeating the word
 * in the bar was redundant (Jake, 2026-08-19). Every other screen keeps its
 * top-bar title.
 *
 * ## Why a plain <img> and not next/image
 *
 * Nothing in this app uses `next/image` — the headshot, avatar and survey
 * components all render plain `<img>` (each with the same eslint-disable comment
 * this file carries). Two concrete reasons to stay on that path rather than make
 * the dashboard the one exception:
 *
 *  1. The two crops are ALREADY prepared and committed (1920px and 960px), so
 *     the responsive work is done. `next/image` would ignore the 960 file and
 *     re-derive its own ladder through the Vercel image-optimization pipeline —
 *     a billed transform per size, for an asset that never changes.
 *  2. `next/image` renders its own positioned wrapper, which fights the
 *     absolutely-positioned scrim layers stacked over the photo here.
 *
 * A hand-written `srcSet`/`sizes` gives the same bandwidth saving with none of
 * that, and keeps the build free of a new config surface (`images.*`).
 *
 * ## The scrim (do not lighten without re-measuring)
 *
 * The photo is a bright skylit atrium — its whites are genuinely blown out
 * (relative luminance 1.0), so white text on the bare image is illegible. Two
 * stacked navy layers fix that:
 *
 *  - a flat `navy-900/45` wash over the whole band, which also brand-tints it;
 *  - a left-to-right `navy-900` gradient, 80% → 60% → 35%, heaviest under the
 *    text and lightest over the flags and greenery on the right.
 *
 * Combined that is ~89% navy at the left edge easing to ~64% at the right.
 *
 * Those two opacities were MEASURED, not guessed. Method: render the page,
 * hide the two text elements, screenshot, and read the luminance of the pixels
 * inside each line's exact glyph rectangle. Worst single pixel behind the text,
 * against white:
 *
 *              1440px    1024px
 *   heading     9.5:1     8.0:1
 *   subtitle    7.4:1     7.4:1
 *
 * Both lines clear WCAG AAA (7:1) at both widths, and the heading is large text
 * besides. The margin is not generous — `gray-200` on the subtitle measured
 * 6.0:1 at 1024px, which is why it is white — so re-run that measurement if you
 * lighten either layer, move the text, or swap the photo.
 */


/**
 * The KPI strip straddles the band's bottom edge: this class pulls it up by 72px
 * — half of a `raised` `size="lg"` MetricCard (24px padding + 32px label + 40px
 * value + 20px sub-line + 24px padding = 144px), so the tiles sit half on the
 * photo and half below it.
 *
 * Desktop only, on purpose. Below `lg` the KPI strip is not rendered at all (the
 * dashboard is search-first on a phone), so there is nothing to overlap and no
 * negative margin to go wrong when the grid collapses to one column.
 *
 * Two rules have to agree for this to look right, and BOTH literals live in this
 * file so they cannot drift:
 *   - this `-mt`, which must be exactly the band's `lg:pb-[72px]` — the page
 *     zeroes its own `lg:pt-0` so the pull is measured straight off the band;
 *   - that `lg:pb-[72px]` on the text well, which reserves the strip of photo
 *     the tiles will cover so the greeting is never behind a card.
 *
 * It is a MARGIN, not a transform or a negative `top`: margin actually shortens
 * the flow, so the search card below moves up with the tiles instead of leaving
 * a 72px hole — and nothing overlaps it.
 */
export const HERO_OVERLAP_CLASS = "lg:-mt-[56px]";

/** The plain greeting the branch briefly used instead of the band — kept so the
 *  two can be compared without digging through git history. Unused. */
export function DashboardGreeting({ greeting }: { greeting: string }) {
  return (
    <div className="pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        {greeting}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Here&rsquo;s what&rsquo;s happening across the BYU Finance alumni
        network today.
      </p>
    </div>
  );
}

/** Shell: the photo, the scrim, and a content well that leaves room at the
 *  bottom for the overlapping KPI tiles. Used by the live page and by the
 *  loading skeleton, so the two are the same height to the pixel. */
export function HeroBand({
  children,
  action,
}: {
  children: React.ReactNode;
  /** Rendered over the top-right of the band — the dashboard puts Sign out here. */
  action?: React.ReactNode;
}) {
  return (
    // `overflow-hidden` clips the photo to the band — it holds NOTHING that has
    // to escape (the KPI tiles that overlap the band are a sibling BELOW it, so
    // their shadows are never clipped by this).
    // ⚠️ SHORTER AT `lg` THAN AT `md`, WHICH LOOKS LIKE A TYPO AND IS NOT
    // (Jake, 2026-08-20). `lg` is the only breakpoint where the KPI strip, the
    // search card AND the Industry breakdown are all rendered, competing for one
    // laptop viewport that the page is not allowed to scroll. The breakdown is
    // the content; this photo is decoration. When they cannot both fit, the
    // decoration gives up its height — 256px to 176px, which is the ~3 industry
    // rows that were being pushed under the fold.
    //
    // 176px is a floor, not a preference: the text well reserves 72px at the
    // bottom for the tiles that straddle the edge (`lg:pb-[72px]`), and the
    // greeting plus its subtitle need ~72px of the rest. Take much more and the
    // heading starts colliding with the tiles.
    <div className="relative h-52 shrink-0 overflow-hidden md:h-60 lg:h-36">
      {/* Decorative: the band's meaning is entirely in the text over it, so the
          photo is alt="" and hidden from the a11y tree rather than described.
          eslint-disable-next-line @next/next/no-img-element -- see the
          next/image note in this file's header. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/dashboard-hero.jpg"
        /* 960 / 1280 / 1920. The 1280 was added on 2026-08-21 because the two-
           step set was making the common case pay for the rare one: `sizes`
           resolves to ~1270px on a laptop — the viewport less the 15rem sidebar
           — which is one pixel over the 960 candidate, so every laptop
           downloaded the 1920 file. 320 kB instead of 650 kB on the first paint
           of the screen everyone lands on, for one extra file in the repo. */
        srcSet="/images/dashboard-hero-960.jpg 960w, /images/dashboard-hero-1280.jpg 1280w, /images/dashboard-hero.jpg 1920w"
        /* The band is the content column: full width on mobile, and the viewport
           less the 15rem sidebar from md up. */
        sizes="(min-width: 768px) calc(100vw - 15rem), 100vw"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
        /* A band this wide crops ~60% of the photo's height away. Centred, the
           window lands on the escalators and floor; `45%` keeps the international
           flags and the skylight in frame instead. */
        style={{ objectPosition: "center 45%" }}
      />
      {/* Scrim, layer 1 of 2 — flat wash. See the header note for the measured
          contrast; these two opacities are load-bearing, not decoration. */}
      <div aria-hidden="true" className="absolute inset-0 bg-navy-900/45" />
      {/* Scrim, layer 2 of 2 — heaviest under the text on the left. Every stop
          is an opacity of the SAME navy so the ramp stays one colour; a
          `to-transparent` stop would fade through transparent BLACK and grey the
          right-hand side out. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-navy-900/80 via-navy-900/60 to-navy-900/35"
      />
      {/* The band's own top-right action, over both scrims. Absolute rather than
          a row inside the text well: the well is vertically centred and the
          action belongs at the top edge, and taking it out of that flow also
          means a long greeting can never push it off the band. `z-10` puts it
          above the gradient; `pointer-events-none` on the wrapper with it
          restored on the child keeps the rest of the band unclickable, so the
          invisible box does not eat clicks meant for the search card below. */}
      {action ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end px-4 pt-4 md:px-6">
          <div className="pointer-events-auto">{action}</div>
        </div>
      ) : null}
      {/* The text well. Bottom padding from `lg` up reserves the strip of band
          the KPI tiles cover, so the greeting is never behind a card. Below `lg`
          the KPI strip isn't rendered at all, so no room is reserved. Top
          padding clears the action above when the band is short. */}
      {/* `pt-12` clears the Sign out button ONLY where the band is narrow enough
          for the greeting to run under it. From `lg` the band is the viewport
          less a 15rem sidebar — the greeting ends hundreds of pixels short of
          the button — and the reservation is pure waste there: with the band cut
          to 176px, 48px of top padding plus the 72px reserved for the tiles
          leaves less than the heading needs, and the text overflows the band it
          is supposed to sit inside. */}
      <div className="relative flex h-full flex-col justify-center px-4 pt-12 md:px-6 lg:pb-[56px] lg:pt-0">
        {children}
      </div>
    </div>
  );
}

/** The live band: "Welcome back, {name}" and the standing subtitle. */
/**
 * The photo band, back on the dashboard (Jake, 2026-08-21) — it now appears
 * BELOW the nav's photo rather than instead of it.
 *
 * ⚠️ NO `action` HERE ANY MORE. The band carried Sign out only because this page
 * had no top bar; with the bar carrying it, passing it again put two on screen
 * at once. That is the one part of removing the band that should not come back.
 *
 * ⚠️ And it costs ~144px, on a page whose bottom row was already competing for
 * height with a 96px bar. If the Industry breakdown starts clipping, this is
 * where the height went.
 */
export function DashboardHero({ greeting }: { greeting: string }) {
  return (
    <HeroBand>
      {/* 36px — one step ABOVE the 24–30px page-title band in UX-UI.md's type
          scale, because this is the dashboard's masthead rather than a section
          title, and the scale has no rung between 30px and 36px. */}
      <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm md:text-3xl">
        {greeting}
      </h1>
      {/* WHITE, not a muted grey. Stepping a masthead's second line down to
          `gray-200` is the usual move and it WAS this line — measured against
          the actual rendered pixels it came out at 6.0:1 at a 1024px viewport,
          where the narrower band pushes the end of the sentence into the lighter
          half of the gradient. That passes AA but not AAA, on the line most
          likely to be skimmed. White clears 7:1 at every width; the hierarchy is
          carried by size and weight instead (36px bold over 16px regular).
          `max-w-2xl` stops the line running further right still. */}
      <p className="mt-1 max-w-2xl text-sm font-normal text-white">
        Here&rsquo;s what&rsquo;s happening across the BYU Finance alumni network
        today.
      </p>
    </HeroBand>
  );
}
