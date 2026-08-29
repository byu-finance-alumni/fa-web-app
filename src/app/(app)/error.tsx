"use client";

import { useEffect, useState } from "react";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { clientGet } from "@/lib/api-client";
import type { SupportContact } from "@/types/support";

/** Error boundary for the authenticated app shell. Renders inside the sidebar
 * layout, so a single failing page (e.g. the backend API is unreachable) shows
 * a recoverable error in the content area instead of taking down the whole UI.
 *
 * Because the user is signed in here, we fetch the engineer-managed support
 * contacts and show them. Best-effort: if that fetch also fails (e.g. the API
 * is down), the screen falls back to the generic contact line. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  // True until the support-contacts fetch settles. While pending, ErrorScreen
  // suppresses the generic contact line so it never flashes the generic copy
  // and then swaps in the named contacts a moment later.
  const [contactsPending, setContactsPending] = useState(true);

  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  useEffect(() => {
    let active = true;
    clientGet<SupportContact[]>("/support-contacts")
      .then((data) => {
        if (active) setContacts(data);
      })
      .catch(() => {
        /* API unreachable — fall back to the generic contact line. */
      })
      .finally(() => {
        if (active) setContactsPending(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ErrorScreen
      title="This page didn’t load"
      message="We couldn’t load this data right now. The service may be temporarily unavailable. Try again in a moment."
      reset={reset}
      contacts={contacts}
      contactsPending={contactsPending}
    />
  );
}
