"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SupportContacts } from "@/components/shared/SupportContacts";
import { clientGet } from "@/lib/api-client";
import type { SupportContact } from "@/types/support";

/** 404 — shown for unmatched routes and `notFound()` calls.
 *
 * Like the in-app error boundary, a signed-in user gets the engineer-managed
 * support contacts (with names); we fetch them best-effort. For signed-out
 * users the fetch 401s and we fall back to the generic contact line. The
 * `contactsPending` flag suppresses that fallback while the fetch is in flight
 * so the screen never flashes the generic line then swaps in the named ones. */
export default function NotFound() {
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [contactsPending, setContactsPending] = useState(true);

  useEffect(() => {
    let active = true;
    clientGet<SupportContact[]>("/support-contacts")
      .then((data) => {
        if (active) setContacts(data);
      })
      .catch(() => {
        /* Unauthenticated or API unreachable — show the generic contact line. */
      })
      .finally(() => {
        if (active) setContactsPending(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <Card className="w-full max-w-md p-8 text-center">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
          <FileQuestion className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          Error 404
        </p>
        <h1 className="text-lg font-semibold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          The page you’re looking for doesn’t exist or may have been moved.
        </p>
        {contacts.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm text-gray-500">
              If you reached this from a link inside the app, contact:
            </p>
            <div className="mt-1.5">
              <SupportContacts contacts={contacts} align="center" />
            </div>
          </div>
        ) : contactsPending ? (
          /* Contacts still loading — reserve the space, show no line yet. */
          <div className="mt-4 h-5" aria-hidden="true" />
        ) : (
          <p className="mt-4 text-sm text-gray-500">
            If you reached this from a link inside the app, please contact the{" "}
            <span className="font-medium text-gray-700">
              BYU Finance Department
            </span>
            .
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/dashboard">Go home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
