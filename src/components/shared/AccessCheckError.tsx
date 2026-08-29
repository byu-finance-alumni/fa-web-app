import { Topbar } from "@/components/shell/Topbar";
import { LoadError } from "@/components/shared/LoadError";
import type { Crumb } from "@/components/ui/Breadcrumb";

/**
 * The screen a permission-gated page shows when `/auth/context` could not be
 * READ at all — a 5xx, a timeout, an unreachable API (#688).
 *
 * WHY IT IS NOT A REDIRECT. Every gate in this app used to collapse "the
 * backend says no" and "the backend did not answer" into one `catch`, and then
 * bounced the user somewhere else. Two things went wrong with that during the
 * 2026-08-18 outage. The user was moved off the URL they asked for — so the
 * report came back as "the Add alumni button is broken", not "the API is down"
 * — and the page they landed on was itself broken, which made the redirect look
 * like the app's own confusion rather than a symptom. Staying put and saying so
 * keeps the URL honest: the address bar still names what they were trying to
 * open, a reload retries exactly that, and the words on screen name the fault.
 *
 * WHY IT IS NOT THE PAGE. Failing the other way — rendering the gated screen
 * because we could not disprove entitlement — is worse than either. These pages
 * hold alumni records. An unreadable context means we do not know what this
 * account may do, so the only safe answer is neither "yes" nor a guess: it is
 * this. A genuine 401/403 never reaches here; that is a real answer and its
 * caller redirects on it, exactly as before.
 *
 * The backend re-enforces every one of these gates on every request, so nothing
 * here is the security boundary — but a UI that opens a door it could not check
 * is still a door opened, and this component is what stops that.
 */
export function AccessCheckError({
  status,
  title,
  breadcrumb,
}: {
  /** `ApiError.status` from the failed context read; null when nothing answered. */
  status: number | null;
  /** Page title, for a top-level screen with no breadcrumb trail. */
  title?: string;
  /** Breadcrumb trail, for a screen below the top level (UX-UI.md §Layout). */
  breadcrumb?: Crumb[];
}) {
  return (
    <>
      {/* Keep the page's own chrome. The user is still where they navigated to,
          and the trail is their way back out without a browser Back. */}
      <Topbar title={title} breadcrumb={breadcrumb} />
      <main className="flex-1 overflow-auto p-6">
        <LoadError
          status={status}
          // Only reached when `title`/`message` are both overridden below, but
          // passed anyway so the component keeps one contract.
          noun="this screen"
          title="We couldn’t check what your account can do"
          message="The service that resolves your roles and permissions isn’t responding, so this screen wasn’t opened. Showing it without checking could hand you a control your account isn’t entitled to. Your access hasn’t changed. Try again in a moment."
          className="mx-auto max-w-xl"
        />
      </main>
    </>
  );
}
