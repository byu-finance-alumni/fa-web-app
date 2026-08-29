import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FALLBACK_MESSAGE,
  getMaintenanceStatus,
} from "@/lib/maintenance";

/**
 * The public maintenance page.
 *
 * Lives OUTSIDE the `(app)` route group so it renders none of the app shell —
 * no sidebar, no session lookup, no backend data call. It has to work for a
 * visitor who is signed out (which, during maintenance, is nearly everyone: the
 * switch ends every non-engineer session).
 *
 * It says the site is unavailable and nothing else. No cause, no ETA we can't
 * keep, no stack detail, no "who turned it on" — the status endpoint behind it
 * physically cannot return any of that. The only copy that varies is the
 * engineer-authored public message.
 *
 * The "Sign in" link is load-bearing, not decoration: engineers are exempt from
 * the pause, so `/login` stays open and this page must not become a dead end
 * for the person who has to turn maintenance back off.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Temporarily unavailable",
};

export default async function MaintenancePage() {
  const status = await getMaintenanceStatus();
  // Bookmarked, or maintenance ended while this tab sat here. Send them back to
  // the app rather than showing a maintenance page for a site that is up; the
  // middleware bounces them to /login if they need to sign in.
  if (!status.enabled) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="bg-navy-800">
        <div className="flex h-16 items-center px-5 sm:px-8">
          <span className="text-base font-semibold text-white sm:text-lg">
            BYU Finance Alumni Database
          </span>
        </div>
      </header>

      <div className="mx-auto flex max-w-[640px] flex-col px-5 pb-16 pt-20 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          Temporarily unavailable
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
          The site is down for maintenance
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-600">
          {status.message ?? FALLBACK_MESSAGE}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-gray-500">
          You have been signed out. Nothing you saved has been lost. Sign in
          again once maintenance is finished.
        </p>

        <div className="mt-8 border-t border-gray-300 pt-6">
          <Link
            href="/login"
            className="text-sm font-semibold text-brand-blue-600 underline-offset-4 hover:text-brand-blue-500 hover:underline"
          >
            Sign in
          </Link>
          <p className="mt-1 text-xs text-gray-500">
            Staff performing the maintenance can still sign in.
          </p>
        </div>
      </div>

      <footer className="mt-12 text-center">
        <p className="text-xs text-gray-400">BYU Marriott School of Business</p>
      </footer>
    </main>
  );
}
