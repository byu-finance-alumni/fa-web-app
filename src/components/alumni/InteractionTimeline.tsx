"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Interaction } from "@/types/profile";
import type { Note } from "@/types/notes";
import { clientGet } from "@/lib/api-client";
import { EntityNotes } from "@/components/notes/EntityNotes";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  AddInteractionButton,
  InteractionRowActions,
} from "@/components/alumni/ProfileDialogs";

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
 * `canAdd` gates ONLY the "+ Log interaction" control — it's the broad edit tier
 * PLUS professors (view_only), who the backend allows to POST interactions
 * (fa-web-api#129). `canEdit` (the broad edit tier, includes students) gates the
 * per-row edit/delete affordances: the API only exposes a `logged_by` display
 * string, not the author's user id, so the frontend can't reliably tell which
 * interactions a professor authored — edit/delete therefore stay on the edit
 * tier (any of whose members may edit/delete any row). `canWriteNotes` is the
 * narrower full_access tier used to gate note writing (#39).
 */
export function InteractionTimeline({
  alumniId,
  items,
  canAdd = false,
  canEdit,
  canWriteNotes = false,
}: {
  alumniId: number;
  items: Interaction[];
  canAdd?: boolean;
  canEdit: boolean;
  canWriteNotes?: boolean;
}) {
  // Filter the timeline by interaction type (#222). Distinct types are derived
  // from the items themselves so the menu always mirrors what's actually logged;
  // "All" (empty value) is the default. Case-insensitive match so imported
  // variants of the same type collapse together.
  const [typeFilter, setTypeFilter] = useState("");
  const types = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of items) {
      const t = i.interaction_type?.trim();
      if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const shown = useMemo(
    () =>
      typeFilter
        ? items.filter(
            (i) =>
              (i.interaction_type ?? "").toLowerCase() ===
              typeFilter.toLowerCase(),
          )
        : items,
    [items, typeFilter],
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Interactions</h3>
        <div className="flex items-center gap-2">
          {types.length ? (
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter interactions by type"
              className="h-9 w-auto"
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          ) : null}
          {canAdd ? (
            <AddInteractionButton
              alumniId={alumniId}
              label="+ Log interaction"
              primary
            />
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No interactions logged yet.
        </p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No {typeFilter} interactions logged yet.
        </p>
      ) : (
        <ul className="relative space-y-1">
          {shown.map((i, idx) => {
            const isLast = idx === shown.length - 1;
            return (
              <li key={i.interaction_id} className="relative flex gap-3 py-3">
                {/* Vertical timeline connector — restrained 1px gray line. */}
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-1.5 top-5 bottom-0 w-px bg-gray-300"
                  />
                ) : null}
                {/* Square timeline marker (no icon, no pill) — #225. */}
                <span
                  aria-hidden="true"
                  className="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-sm bg-brand-blue-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant="neutral">
                        {i.interaction_type ?? "Interaction"}
                      </Badge>
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
