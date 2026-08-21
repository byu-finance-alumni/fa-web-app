"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * ``onDark`` marks that this instance sits on a photo. The button keeps its
 * ordinary white ``secondary`` styling — which is exactly what reads cleanly
 * over the band — and only gains a shadow, so it lifts off the image instead of
 * looking painted onto it.
 *
 * A PROP AND NOT A SECOND COMPONENT, because the interesting part of this file
 * is the sign-out itself: clear the Supabase session, then `replace` + `refresh`
 * so middleware re-evaluates and redirects. A copy of that for the dashboard is
 * how one of the two ends up not refreshing and leaving a signed-out user on a
 * page that still looks signed in.
 */
export function SignOutButton({ onDark = false }: { onDark?: boolean } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Refresh so middleware re-evaluates the (now empty) session and the server
    // redirects to /login.
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleSignOut}
      disabled={loading}
      // SOLID WHITE on the photo (Jake, 2026-08-20), not the translucent
      // outline this started as. It is also the plainer choice: a white box with
      // dark text has a fixed contrast ratio no matter what the photo is doing
      // behind it, where the translucent version's legibility depended on which
      // pixels happened to land under the label at that viewport width.
      className={onDark ? "shadow-sm" : undefined}
    >
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
