"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X, ChevronRight, Pencil } from "lucide-react";
import { clientGet } from "@/lib/api-client";
import type { Note } from "@/types/notes";
import { EntityNotes } from "@/components/notes/EntityNotes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface EventRow {
  event_id: number;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  event_location: string | null;
  attendance_count: number;
}

interface EventDetail extends EventRow {
  event_notes: string | null;
}

interface Attendee {
  alumni_id: number;
  name: string;
  graduation_year: number | null;
  attendance_status: string | null;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Interactive events list: clicking a row opens a read-only slide-out drawer
 * (mirrors the geography state drawer) with the event's details and attendee
 * list. Detail + attendees are fetched client-side on open.
 */
export function EventsExplorer({
  events,
  initialOpenId,
  canWriteNotes = false,
  canManageEvents = false,
}: {
  events: EventRow[];
  /** Event id to auto-open on mount — set from the `?event=<id>` deep-link
   *  (e.g. the dashboard's Event-participation panel links here). */
  initialOpenId?: number;
  /** full_access tier — gates writing event discussion notes (#39). Read is
   *  open to every view-access role; the backend re-enforces writes. */
  canWriteNotes?: boolean;
  /** full_access tier — gates the drawer's "Edit" entry point to
   *  /events/{id}/edit. view_only ("Professor") never sees it. */
  canManageEvents?: boolean;
}) {
  const [selected, setSelected] = useState<EventRow | null>(null);

  // Deep-link support: when arriving via /events?event=<id>, auto-open that
  // event's drawer once the list is available. If the id isn't in the loaded
  // list (e.g. filtered out by active search), we just stay on the list.
  useEffect(() => {
    if (initialOpenId == null) return;
    const match = events.find((e) => e.event_id === initialOpenId);
    if (match) setSelected(match);
  }, [initialOpenId, events]);

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="space-y-2 md:hidden">
        {events.map((e) => (
          <button
            key={e.event_id}
            type="button"
            onClick={() => setSelected(e)}
            className="block w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-card hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">
                {e.event_name}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {e.event_type ? (
                  <Badge variant="tag">{e.event_type}</Badge>
                ) : null}
                <ChevronRight
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {[formatDate(e.event_date), e.event_location]
                .filter((x) => x && x !== "—")
                .join(" · ")}
              {` · ${e.attendance_count} attending`}
            </p>
          </button>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2.5">Event</th>
              <th className="w-44 px-4 py-2.5">Type</th>
              <th className="w-36 px-4 py-2.5">Date</th>
              <th className="w-44 px-4 py-2.5">Location</th>
              <th className="w-32 px-4 py-2.5 text-right">Attendance</th>
              <th className="w-24 px-4 py-2.5 text-right">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr
                key={e.event_id}
                onClick={() => setSelected(e)}
                className="group cursor-pointer border-b border-gray-200 last:border-0 hover:bg-gray-50"
              >
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {e.event_name}
                </td>
                <td className="px-4 py-2.5">
                  {e.event_type ? (
                    <Badge variant="tag">{e.event_type}</Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-gray-700">
                  {formatDate(e.event_date)}
                </td>
                <td className="px-4 py-2.5 text-gray-700">
                  {e.event_location ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                  {e.attendance_count}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue-600 group-hover:text-brand-blue-500">
                    View
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <EventDrawer
          event={selected}
          onClose={() => setSelected(null)}
          canWriteNotes={canWriteNotes}
          canManageEvents={canManageEvents}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------- discussion notes -- */

/**
 * Collapsible unified-notes thread for a single event (#39) — mirrors
 * `InteractionNotes`. Notes are loaded lazily the first time the disclosure is
 * opened (any view-access role); writing is gated to `canWrite` (full_access)
 * and re-enforced by the backend. The count badge reflects the latest loaded
 * notes once expanded.
 */
function EventNotes({
  eventId,
  canWrite,
}: {
  eventId: number;
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
        `/notes?entity_type=event&entity_id=${eventId}`,
      );
      setNotes(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && notes === null && !loading) void load();
  }

  const count = notes?.length ?? 0;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`event-notes-${eventId}`}
        aria-label="Discussion notes for this event"
        className="flex items-center gap-1 rounded-md text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        Notes{notes !== null && count > 0 ? ` (${count})` : ""}
      </button>
      {open ? (
        <div
          id={`event-notes-${eventId}`}
          className="mt-3 border-l border-gray-200 pl-3"
        >
          {loading ? (
            <p className="py-2 text-xs text-gray-500">Loading notes…</p>
          ) : error ? (
            <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
              <span>Couldn&apos;t load notes.</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => void load()}
                className="h-auto p-0 text-xs"
              >
                Retry
              </Button>
            </div>
          ) : (
            <EntityNotes
              entityType="event"
              entityId={eventId}
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

/* ----------------------------------------------------------------- drawer -- */

function EventDrawer({
  event,
  onClose,
  canWriteNotes,
  canManageEvents,
}: {
  event: EventRow;
  onClose: () => void;
  canWriteNotes: boolean;
  canManageEvents: boolean;
}) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([
      clientGet<EventDetail>(`/events/${event.event_id}`),
      clientGet<Attendee[]>(`/events/${event.event_id}/attendees`),
    ])
      .then(([d, a]) => {
        if (!cancelled) {
          setDetail(d);
          setAttendees(a);
        }
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [event.event_id]);

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default bg-navy-900/30"
      />
      <aside
        role="dialog"
        aria-label={event.event_name}
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-gray-100 shadow-xl sm:w-[440px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white p-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900">
              {event.event_name}
            </h3>
            <p className="text-sm text-gray-500">
              {[formatDate(event.event_date), event.event_location]
                .filter((x) => x && x !== "—")
                .join(" · ") || "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManageEvents ? (
              <Button asChild size="sm">
                <Link href={`/events/${event.event_id}/edit`}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5">
          {/* Facts */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <dl className="space-y-2 text-sm">
              <Fact label="Type" value={event.event_type ?? "—"} />
              <Fact label="Date" value={formatDate(event.event_date)} />
              <Fact label="Location" value={event.event_location ?? "—"} />
              <Fact
                label="Attendance"
                value={String(
                  (detail ?? event).attendance_count ?? event.attendance_count,
                )}
              />
            </dl>
          </div>

          {/* Description */}
          {loading ? (
            <div className="h-24 animate-pulse rounded-lg border border-gray-200 bg-white" />
          ) : detail?.event_notes ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Description
              </p>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {detail.event_notes}
              </p>
            </div>
          ) : null}

          {/* Discussion notes (#39) — additive unified-notes thread, distinct
              from the primary `event_notes` shown as Description above. Lazily
              loaded the first time the disclosure is opened. */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <EventNotes eventId={event.event_id} canWrite={canWriteNotes} />
          </div>

          {/* Attendees */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Attendees
            </p>
            {loading ? (
              <p className="py-3 text-sm text-gray-500">Loading…</p>
            ) : error ? (
              <p className="py-3 text-sm text-gray-500">
                Couldn&apos;t load attendees.
              </p>
            ) : attendees && attendees.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {attendees.map((a) => (
                  <li key={a.alumni_id} className="py-2">
                    <Link
                      href={`/alumni/${a.alumni_id}`}
                      className="block hover:opacity-80"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {a.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[
                          a.graduation_year ? `Class of ${a.graduation_year}` : null,
                          a.attendance_status,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm text-gray-500">No attendees recorded.</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="truncate text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}
