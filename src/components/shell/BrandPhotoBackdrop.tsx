/**
 * The Marriott School photo treatment that sits behind the app's top bar —
 * the photo itself plus the two scrims that give white type its contrast.
 *
 * Extracted from `TopNav` (#756) so the PUBLIC survey shell can wear the same
 * background without importing the nav. It is the *background only*: no links,
 * no nav, no session, no state. Keep it that way — `/survey/*` skips auth
 * entirely (`isNoAuthPath`), so anything auth-dependent that lands in here
 * would follow the backdrop straight onto a page strangers open.
 *
 * Absolutely positioned, so the caller must be a positioning context
 * (`relative`) and owns the height. Everything drawn on top of it needs its own
 * `relative` so it stacks above.
 *
 * ⚠️ Do NOT add a border, a rule, or any full-width element beneath the photo
 * at the call site. A pale band under this photo has come back four separate
 * times (a white topbar, a zero-height overlay, a breadcrumb line, a per-page
 * search slot) — any full-width strip between the dark photo and the page reads
 * as a pale bar whether or not anything is drawn in it.
 */
export function BrandPhotoBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/dashboard-hero.jpg"
        srcSet="/images/dashboard-hero-960.jpg 960w, /images/dashboard-hero-1280.jpg 1280w, /images/dashboard-hero.jpg 1920w"
        sizes="100vw"
        alt=""
        aria-hidden="true"
        /* FIXED 240px, anchored to the top of the bar — NOT `h-full`.
           `object-cover` frames against the box it is in, so a 240px header
           (the dashboard, with its masthead) and a 64px one (everywhere else,
           the survey included) showed different slices of the photo and the bar
           looked like a different image page to page. At a constant height the
           top 64px is always the same pixels; a short header just clips the
           rest. */
        className="absolute inset-x-0 top-0 h-60 w-full object-cover"
        style={{ objectPosition: "center 45%" }}
      />
      {/* ONE TREATMENT, EVERYWHERE (Jake, 2026-08-21): a flat wash plus a
          left-heavy gradient.

          ⚠️ These two opacities are the contrast, not decoration. A bare photo
          was tried and white type vanished into the atrium skylight. Lighten
          either layer and check the wordmark over the brightest part of the
          image before keeping it. */}
      <div aria-hidden="true" className="absolute inset-0 bg-navy-900/45" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-navy-900/80 via-navy-900/60 to-navy-900/35"
      />
    </div>
  );
}
