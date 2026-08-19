"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { clearLastActivity, getActivityStorage } from "@/lib/idleSession";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    // Drop the persisted idle timestamp (#684) so the next login on this
    // browser starts a clean idle window rather than inheriting this session's.
    clearLastActivity(getActivityStorage());
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
    >
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
