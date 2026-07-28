"use client";

import { Button } from "@/components/ui/button";
import { Fab } from "@/components/shared/Fab";

/**
 * Profile speed-dial FAB — the generic {@link Fab} with the mobile alumni
 * profile's actions passed as children (Add interaction, Add note, Create task,
 * Edit, Export, Archive). Kept as a thin alias so the profile page's import is
 * self-describing.
 */
export { Fab as ProfileFab };

/**
 * "Add note" speed-dial action. Notes are added via an inline textarea in the
 * Notes section (not a dialog), so this scrolls that field into view and focuses
 * it. Gated by the caller to note-writers (full_access+), matching the field.
 */
export function AddNoteButton() {
  return (
    <Button
      type="button"
      onClick={() => {
        const el = document.getElementById("profile-note-input");
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLTextAreaElement).focus({ preventScroll: true });
      }}
    >
      Add note
    </Button>
  );
}
