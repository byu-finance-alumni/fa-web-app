"use client";

import {
  Users,
  Phone,
  StickyNote,
  CalendarDays,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { Interaction } from "@/types/profile";
import {
  AddInteractionButton,
  InteractionRowActions,
} from "@/components/alumni/ProfileDialogs";

/** Pick a category icon from the free-text interaction type. */
function iconFor(type: string | null): LucideIcon {
  const t = (type ?? "").toLowerCase();
  if (t.includes("call")) return Phone;
  if (t.includes("note")) return StickyNote;
  if (t.includes("event")) return CalendarDays;
  if (t.includes("meeting")) return Users;
  return MessageSquare;
}

/** Render an interaction timestamp in Utah / Mountain time. */
const fmtMountain = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Denver",
        timeZoneName: "short",
      })
    : "—";

/**
 * Dedicated interactions timeline (issue #38) — interactions only, newest
 * first. Distinct from `ProfileActivity`, which merges audit events in. Editors
 * can log, edit, and delete from here; view-only users see a read-only history.
 */
export function InteractionTimeline({
  alumniId,
  items,
  canEdit,
}: {
  alumniId: number;
  items: Interaction[];
  canEdit: boolean;
}) {
  return (
    <section className="rounded-xl border border-gray-300 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-gray-900">Interactions</h3>
        {canEdit ? (
          <AddInteractionButton
            alumniId={alumniId}
            label="+ Log interaction"
            primary
          />
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No interactions logged yet.
        </p>
      ) : (
        <ul className="relative space-y-1">
          {items.map((i, idx) => {
            const Icon = iconFor(i.interaction_type);
            const isLast = idx === items.length - 1;
            return (
              <li key={i.interaction_id} className="relative flex gap-3 py-3">
                {/* Vertical timeline connector — restrained 1px gray line. */}
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-11 bottom-0 w-px -translate-x-1/2 bg-gray-300"
                  />
                ) : null}
                <span className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {i.interaction_type ?? "Interaction"}
                      </span>
                      <p className="mt-1 text-xs text-gray-500">
                        {fmtMountain(i.interaction_date_time)}
                        {" · "}
                        {i.logged_by ?? "—"}
                      </p>
                    </div>
                    {canEdit ? (
                      <InteractionRowActions alumniId={alumniId} row={i} />
                    ) : null}
                  </div>
                  {i.interaction_notes ? (
                    <p className="mt-1 text-sm text-gray-600">
                      {i.interaction_notes}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
