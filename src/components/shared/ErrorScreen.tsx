"use client";

import Link from "next/link";
import { SupportContacts } from "@/components/shared/SupportContacts";
import { Button } from "@/components/ui/button";
import type { SupportContact } from "@/types/support";

/**
 * Branded error / empty screen shared by the route error boundaries and the 404
 * page. Plain and on-brand — a large muted status code, a clear heading, one
 * line of explanation, who to contact, and the actions. No illustration or icon
 * badge, so it reads like a real error page rather than a decorated card.
 *
 * `contacts` (passed only by the authenticated in-app error boundary) lists the
 * engineer-managed support contacts (name + email, no role label); when present
 * they replace the generic "BYU Finance Department" line. Pre-auth screens
 * (root error, 404) pass none.
 */
export function ErrorScreen({
  title,
  message,
  reset,
  contacts,
  contactsPending,
}: {
  /** Accepted for compatibility with callers (e.g. "404") but no longer shown —
   * the screen uses a generic question mark instead. */
  code?: string;
  title: string;
  message: string;
  reset?: () => void;
  contacts?: SupportContact[];
  /** True while the caller is still fetching `contacts`. We suppress the generic
   * fallback line until the fetch settles so the screen doesn't flash the
   * generic contact, then swap it for the named contacts a beat later. */
  contactsPending?: boolean;
}) {
  return (
    <div className="flex min-h-[70vh] w-full flex-1 flex-col items-center justify-center bg-canvas px-6 py-12 text-center">
      <p
        className="text-6xl font-light leading-none text-gray-300"
        aria-hidden="true"
      >
        ?
      </p>
      <h1 className="mt-5 text-xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
        {message}
      </p>

      {contacts && contacts.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm text-gray-500">If this keeps happening, contact:</p>
          <div className="mt-1.5">
            <SupportContacts contacts={contacts} align="center" />
          </div>
        </div>
      ) : contactsPending ? (
        /* Contacts still loading — reserve the space but show no contact line yet,
           so we never flash the generic fallback then swap in names. */
        <div className="mt-5 h-5" aria-hidden="true" />
      ) : (
        <p className="mt-5 text-sm text-gray-500">
          If this keeps happening, please contact the{" "}
          <span className="font-medium text-gray-700">BYU Finance Department</span>
          .
        </p>
      )}

      <div className="mt-7 flex items-center justify-center gap-3">
        {reset ? (
          <Button type="button" onClick={reset}>
            Try again
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link href="/dashboard">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
