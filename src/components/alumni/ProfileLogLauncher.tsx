"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddInteractionButton } from "@/components/alumni/ProfileDialogs";

/**
 * Handles the `?log=interaction|note` deep-link the Home quick-log flow
 * ({@link QuickLogButton}) lands on: after picking an alumnus, this opens the
 * matching form on their profile.
 *   - interaction → opens the controlled "Log interaction" dialog immediately.
 *   - note        → scrolls to and focuses the inline note field (which may only
 *                   mount after the mobile stacked layout swaps in, so it retries).
 * The param is stripped once handled so a refresh/Back doesn't re-fire it.
 */
export function ProfileLogLauncher({
  alumniId,
  canAdd,
  canWriteNotes,
}: {
  alumniId: number;
  canAdd: boolean;
  canWriteNotes: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [interactionOpen, setInteractionOpen] = useState(false);

  useEffect(() => {
    const log = params.get("log");
    if (!log) return;

    if (log === "interaction" && canAdd) {
      setInteractionOpen(true);
    } else if (log === "note" && canWriteNotes) {
      let attempts = 0;
      const focusNote = () => {
        const el = document.getElementById("profile-note-input");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          (el as HTMLTextAreaElement).focus({ preventScroll: true });
          return;
        }
        if (attempts++ < 25) setTimeout(focusNote, 100);
      };
      focusNote();
    }

    // Strip ?log so a refresh/Back doesn't re-open the form.
    const next = new URLSearchParams(params.toString());
    next.delete("log");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canAdd) return null;
  return (
    <AddInteractionButton
      alumniId={alumniId}
      open={interactionOpen}
      onOpenChange={setInteractionOpen}
    />
  );
}
