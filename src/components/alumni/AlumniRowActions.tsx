"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Pencil, MessageSquarePlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AddInteractionButton } from "@/components/alumni/ProfileDialogs";

/**
 * Per-row "⋯" action menu for the alumni table. Surfaces View / Edit (role-
 * gated, mirroring the profile page's controls) / Add interaction. All items
 * wire to existing routes/handlers:
 *  - View  → the alumni profile route
 *  - Edit  → the existing /alumni/{id}/edit route (only when `canEdit`)
 *  - Add interaction → the existing logging dialog (controlled `AddInteraction
 *    Button`, only when `canAdd` — same predicate the profile uses), which posts
 *    via the shared `addInteraction` server action. No new endpoints.
 *
 * `canEdit` follows `canEditAlumni` (edit tier) and `canAdd` follows
 * `canAddInteraction` (edit tier + professors), computed server-side on the list
 * page and threaded down so the menu never shows an affordance the backend would
 * reject.
 */
export function AlumniRowActions({
  alumniId,
  canEdit,
  canAdd,
}: {
  alumniId: number;
  canEdit: boolean;
  canAdd: boolean;
}) {
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            // The whole row navigates to the profile; stop that here so opening
            // the menu doesn't also push a route change.
            onClick={(e) => e.stopPropagation()}
            aria-label="Row actions"
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          // Menu lives over a clickable row — keep clicks/selects from bubbling
          // up to the row's navigation handler.
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem asChild>
            <Link href={`/alumni/${alumniId}`}>
              <Eye aria-hidden="true" />
              View profile
            </Link>
          </DropdownMenuItem>
          {canEdit ? (
            <DropdownMenuItem asChild>
              <Link href={`/alumni/${alumniId}/edit`}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canAdd ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                // Defer opening the modal until the menu has closed so focus
                // returns cleanly, then drive the controlled dialog.
                onSelect={(e) => {
                  e.preventDefault();
                  setLogOpen(true);
                }}
              >
                <MessageSquarePlus aria-hidden="true" />
                Add interaction
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canAdd ? (
        <AddInteractionButton
          alumniId={alumniId}
          open={logOpen}
          onOpenChange={setLogOpen}
        />
      ) : null}
    </>
  );
}
