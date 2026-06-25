"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SupportContacts } from "@/components/shared/SupportContacts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SupportContact } from "@/types/support";

/**
 * Branded error/empty screen shared by the route error boundaries and the 404
 * page. Calm, on-brand, and always actionable — the user can retry, go home,
 * and knows who to contact. Never a raw stack trace or white screen.
 *
 * `contacts` (passed only by the authenticated in-app error boundary) lists the
 * engineer-managed support contacts; when present they replace the generic
 * "BYU Finance Department" line. Pre-auth screens (root error, 404) pass none.
 */
export function ErrorScreen({
  code,
  title,
  message,
  reset,
  contacts,
  contactsPending,
}: {
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
    <div className="flex min-h-[60vh] w-full flex-1 items-center justify-center bg-canvas p-6">
      <Card className="w-full max-w-md p-8 text-center">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </span>
        {code ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            {code}
          </p>
        ) : null}
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
        {contacts && contacts.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm text-gray-500">If this keeps happening, contact:</p>
            <div className="mt-1.5">
              <SupportContacts contacts={contacts} align="center" />
            </div>
          </div>
        ) : contactsPending ? (
          /* Contacts still loading — reserve the space but show no contact line
             yet, so we never flash the generic fallback then swap in names. */
          <div className="mt-4 h-5" aria-hidden="true" />
        ) : (
          <p className="mt-4 text-sm text-gray-500">
            If this keeps happening, please contact the{" "}
            <span className="font-medium text-gray-700">
              BYU Finance Department
            </span>
            .
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          {reset ? (
            <Button type="button" onClick={reset}>
              Try again
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href="/dashboard">Go home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
