import type { ReactNode } from "react";

import { BrandPhotoBackdrop } from "@/components/shell/BrandPhotoBackdrop";
import { BrandWordmark } from "@/components/shell/BrandWordmark";

/**
 * The shell every PUBLIC survey screen sits in (#756): the Marriott photo
 * masthead, the reading column, and the Marriott School sign-off.
 *
 * ⚠️ THIS IS NOT `TopNav`, and the difference is the point. `/survey/*` skips
 * authentication entirely (`isNoAuthPath` in the root middleware) — whoever
 * opens the link is a stranger holding a signed token, not a signed-in user.
 * `TopNav` is navigation *into* the app (Alumni, Dashboard, Manage, Engineer,
 * search, sign out) and every one of those links would either bounce a
 * respondent to the login page or look like a door they are not allowed
 * through. So this matches the app's visual language — the same photo, scrims
 * and wordmark type, via `BrandPhotoBackdrop` and `BrandWordmark` — and carries
 * the wordmark and nothing else (Jake, 2026-08-25).
 *
 * ⚠️ NOTHING auth-dependent may be imported into this file or into anything it
 * renders. No session, no user, no `SignOutButton`, no nav model. A public page
 * that reaches for auth state is a runtime error for the one visitor who has
 * none.
 *
 * ⚠️ There is deliberately NO strip between the photo and the content — no
 * border, no rule, no breadcrumb row, no toolbar. A pale band under the photo
 * has come back four separate times on the app side (a white topbar, a
 * zero-height overlay, a breadcrumb line, a per-page search slot); any
 * full-width element in that gap reads as a pale bar whether or not anything is
 * drawn in it. The page below the masthead is one uninterrupted white surface.
 *
 * Renders at ALL widths, unlike `TopNav` (which is `md:` and up because
 * `MobileNav` covers the rest). There is no mobile counterpart here and alumni
 * open these links on their phones, so hiding it would leave the survey with no
 * header at all.
 *
 * Used by the survey page for every one of its states — loading, invalid token,
 * review, confirmed, editing, submitted — and by the ways-to-help page (#755),
 * so a respondent meets one consistent shell the whole way through.
 */
export function SurveyPageShell({
  children,
}: {
  /** The screen's content. Rendered inside the 800px reading column, above the
   *  "BYU Marriott School of Business" sign-off the shell already provides —
   *  do not add another footer. */
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* `relative` only as the positioning context for the backdrop. No
          border-b, no shadow, no anything: see the band warning above. */}
      <header className="relative">
        <BrandPhotoBackdrop />
        {/* `relative` so the wordmark stacks above the scrims. Same 64px row
            and same 32px gutter (from `sm`) the app bar uses. */}
        <div className="relative flex h-16 items-center px-5 sm:px-8">
          <BrandWordmark trail="Finance Alumni Update" />
        </div>
      </header>

      <div className="mx-auto max-w-[800px] px-5 pb-16 pt-10 sm:px-8">
        {children}

        <footer className="mt-12 text-center">
          <p className="text-xs text-gray-400">BYU Marriott School of Business</p>
        </footer>
      </div>
    </main>
  );
}
