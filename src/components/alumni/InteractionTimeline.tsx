"use client";

import { useCallback, useState } from "react";
import {
  Users,
  Phone,
  StickyNote,
  CalendarDays,
  MessageSquare,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { Interaction } from "@/types/profile";
import type { Note } from "@/types/notes";
import { clientGet } from "@/lib/api-client";
import { EntityNotes } from "@/components/notes/EntityNotes";
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
 * Collapsible unified-notes thread for a single interaction (#39). Notes are
 * loaded lazily the first time the disclosure is opened (any view-access role),
 * and writing is gated to `canWrite` (full_access). The count badge reflects the
 * latest loaded notes once expanded.
 */
function InteractionNotes({
  interactionId,
  canWrite,
}: {
  interactionId: number;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await clientGet<Note[]>(
        `/notes?entity_type=interaction&entity_id=${interactionId}`,
      );
      setNotes(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [interactionId]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && notes === null && !loading) void load();
  }

  const count = notes?.length ?? 0;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`interaction-notes-${interactionId}`}
        aria-label="Notes for this interaction"
        className="flex items-center gap-1 rounded-md text-xs font-medium text-gray-700 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        Notes{notes !== null && count > 0 ? ` (${count})` : ""}
      </button>
      {open ? (
        <div
          id={`interaction-notes-${interactionId}`}
          className="mt-2 border-l border-gray-300 pl-3"
        >
          {loading ? (
            <p className="py-2 text-xs text-gray-500">Loading notes…</p>
          ) : error ? (
            <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
              <span>Couldn&apos;t load notes.</span>
              <button
                type="button"
                onClick={() => void load()}
                className="font-medium text-brand-blue-600 hover:text-brand-blue-500"
              >
                Retry
              </button>
            </div>
          ) : (
            <EntityNotes
              entityType="interaction"
              entityId={interactionId}
              notes={notes ?? []}
              canWrite={canWrite}
              onChanged={() => void load()}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Dedicated interactions timeline (issue #38) — interactions only, newest
 * first. Distinct from `ProfileActivity`, which merges audit events in. Editors
 * can log, edit, and delete from here; view-only users see a read-only history.
 *
 * `canEdit` is the broad edit tier (includes students); `canWriteNotes` is the
 * narrower full_access tier used to gate note writing (#39).
 */
export function InteractionTimeline({
  alumniId,
  items,
  canEdit,
  canWriteNotes = false,
}: {
  alumniId: number;
  items: Interaction[];
  canEdit: boolean;
  canWriteNotes?: boolean;
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
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
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
                  <InteractionNotes
                    interactionId={i.interaction_id}
                    canWrite={canWriteNotes}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
