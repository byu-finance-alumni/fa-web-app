"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Title as DialogTitle } from "@radix-ui/react-dialog";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  MapPin,
  MessageSquare,
  Pencil,
  Tag,
  Users,
  X,
} from "lucide-react";
import { clientGet } from "@/lib/api-client";
import type { Note } from "@/types/notes";
import { EntityNotes } from "@/components/notes/EntityNotes";
import { AttendeeManager } from "@/components/events/AttendeeManager";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

/* ------------------------------------------------------- event-type colors -- */

/**
 * Map an event type to a <Badge> variant so the same type always reads with the
 * same color across the list and the detail sheet. The event-type vocabulary is
 * admin-editable (#82) and unbounded, so we can't hardcode an exhaustive map:
 * a small keyword table covers the common cases (networking, recruiting, social
 * events, etc.) and anything unmatched falls back to the brand "tag" color via a
 * stable hash so unfamiliar types stay visually consistent run-to-run.
 */
const TYPE_KEYWORDS: { variant: BadgeProps["variant"]; words: string[] }[] = [
  {
    variant: "success",
    words: ["network", "social", "mixer", "reunion", "alumni", "reception"],
  },
  {
    variant: "warning",
    words: ["recruit", "career", "interview", "info session", "hiring"],
  },
  {
    variant: "neutral",
    words: ["workshop", "training", "panel", "seminar", "webinar", "lecture"],
  },
];

const HASH_FALLBACKS: BadgeProps["variant"][] = ["tag", "neutral", "success"];

function eventTypeVariant(type: string): BadgeProps["variant"] {
  const t = type.toLowerCase();
  for (const { variant, words } of TYPE_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return variant;
  }
  // Stable hash → one of the safe fallbacks, so an unrecognised type keeps the
  // same color everywhere it appears without inventing semantics.
  let hash = 0;
  for (let i = 0; i < t.length; i++) hash = (hash * 31 + t.charCodeAt(i)) >>> 0;
  return HASH_FALLBACKS[hash % HASH_FALLBACKS.length];
}

/** Colored event-type tag, consistent between list and detail. */
function EventTypeBadge({
  type,
  className,
}: {
  type: string | null;
  className?: string;
}) {
  if (!type) return <span className="text-gray-400">—</span>;
  return (
    <Badge variant={eventTypeVariant(type)} className={className}>
      {type}
    </Badge>
  );
}

/**
 * Interactive events list: clicking a row opens a read-only slide-out sheet with
 * the event's details, attendee list, and discussion notes organized into tabs.
 * Detail + attendees are fetched client-side on open.
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
  /** full_access tier — gates the sheet's "Edit" entry point to
   *  /events/{id}/edit. view_only ("Professor") never sees it. */
  canManageEvents?: boolean;
}) {
  const [selected, setSelected] = useState<EventRow | null>(null);

  // Deep-link support: when arriving via /events?event=<id>, auto-open that
  // event's sheet once the list is available. If the id isn't in the loaded
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
                <EventTypeBadge type={e.event_type} />
                <ChevronRight
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <span>
                {[formatDate(e.event_date), e.event_location]
                  .filter((x) => x && x !== "—")
                  .join(" · ")}
              </span>
              <Badge variant="neutral" size="sm" className="tabular-nums">
                {e.attendance_count} attending
              </Badge>
            </div>
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
                  <EventTypeBadge type={e.event_type} />
                </td>
                <td className="px-4 py-2.5 tabular-nums text-gray-700">
                  {formatDate(e.event_date)}
                </td>
                <td className="px-4 py-2.5 text-gray-700">
                  {e.event_location ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Badge variant="neutral" className="tabular-nums">
                    {e.attendance_count}
                  </Badge>
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

      <EventSheet
        event={selected}
        onClose={() => setSelected(null)}
        canWriteNotes={canWriteNotes}
        canManageEvents={canManageEvents}
      />
    </>
  );
}

/* ------------------------------------------------------- discussion notes -- */

/**
 * Unified-notes thread for a single event (#39) — mirrors `InteractionNotes`.
 * Notes are loaded lazily the first time the tab mounts (any view-access role);
 * writing is gated to `canWrite` (full_access) and re-enforced by the backend.
 */
function EventNotes({
  eventId,
  canWrite,
}: {
  eventId: number;
  canWrite: boolean;
}) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="py-2 text-sm text-gray-500">Loading notes…</p>;
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
        <span>Couldn&apos;t load notes.</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => void load()}
          className="h-auto p-0 text-sm"
        >
          Retry
        </Button>
      </div>
    );
  }
  return (
    <EntityNotes
      entityType="event"
      entityId={eventId}
      notes={notes ?? []}
      canWrite={canWrite}
      onChanged={() => void load()}
    />
  );
}

/* ------------------------------------------------------------------ sheet -- */

function EventSheet({
  event,
  onClose,
  canWriteNotes,
  canManageEvents,
}: {
  event: EventRow | null;
  onClose: () => void;
  canWriteNotes: boolean;
  canManageEvents: boolean;
}) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const eventId = event?.event_id;

  useEffect(() => {
    if (eventId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setDetail(null);
    setAttendees(null);
    Promise.all([
      clientGet<EventDetail>(`/events/${eventId}`),
      clientGet<Attendee[]>(`/events/${eventId}/attendees`),
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
  }, [eventId]);

  // Real attendee count: prefer the freshly fetched detail, fall back to the
  // row count. No capacity/RSVP-target exists in the schema, so we never show a
  // denominator — just the true number attending.
  const attendanceCount =
    detail?.attendance_count ?? event?.attendance_count ?? 0;

  return (
    <Sheet open={event != null} onOpenChange={(o) => !o && onClose()}>
      {event != null ? (
        <SheetContent
          aria-label={event.event_name}
          className="w-full gap-0 p-0 sm:max-w-lg"
        >
          {/* Radix Dialog requires an accessible title; we render a rich custom
              header below, so the required Title is provided visually-hidden. */}
          <DialogTitle className="sr-only">{event.event_name}</DialogTitle>

          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold text-gray-900">
                  {event.event_name}
                </h3>
                <EventTypeBadge type={event.event_type} />
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(event.event_date)}
                </span>
                {event.event_location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {event.event_location}
                  </span>
                ) : null}
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
              <SheetClose
                aria-label="Close"
                className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
              >
                <X className="h-4 w-4" />
              </SheetClose>
            </div>
          </div>

          {/* Tabs: Overview / Attendees / Notes */}
          <Tabs
            defaultValue="overview"
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="shrink-0 gap-2 bg-white px-5 pt-3">
              <TabsTrigger value="overview">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="attendees">
                <Users className="h-4 w-4" aria-hidden="true" />
                Attendees
                <Badge variant="neutral" size="sm" className="tabular-nums">
                  {attendanceCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="notes">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Notes
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent
              value="overview"
              className="mt-0 min-h-0 flex-1 space-y-4 overflow-auto p-5"
            >
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <dl className="space-y-3 text-sm">
                  <Fact
                    label="Type"
                    icon={<Tag className="h-4 w-4" aria-hidden="true" />}
                  >
                    <EventTypeBadge type={event.event_type} />
                  </Fact>
                  <Fact
                    label="Date"
                    icon={
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    }
                  >
                    <span className="font-medium tabular-nums text-gray-900">
                      {formatDate(event.event_date)}
                    </span>
                  </Fact>
                  <Fact
                    label="Location"
                    icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                  >
                    <span className="font-medium text-gray-900">
                      {event.event_location ?? "—"}
                    </span>
                  </Fact>
                  <Fact
                    label="Attendance"
                    icon={<Users className="h-4 w-4" aria-hidden="true" />}
                  >
                    <Badge variant="neutral" className="tabular-nums">
                      {attendanceCount}{" "}
                      {attendanceCount === 1 ? "attendee" : "attendees"}
                    </Badge>
                  </Fact>
                </dl>
              </div>

              {/* Description (primary event_notes) */}
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
            </TabsContent>

            {/* ATTENDEES */}
            <TabsContent
              value="attendees"
              className="mt-0 min-h-0 flex-1 overflow-auto p-5"
            >
              {canManageEvents ? (
                // full_access: writable attendance management (add/remove via
                // server actions). The backend re-enforces every write.
                <AttendeeManager eventId={event.event_id} className="mt-0" />
              ) : (
                // view_only: read-only roster.
                <div className="rounded-lg border border-gray-200 bg-white p-4">
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
                                a.graduation_year
                                  ? `Class of ${a.graduation_year}`
                                  : null,
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
                    <p className="py-3 text-sm text-gray-500">
                      No attendees recorded.
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* NOTES */}
            <TabsContent
              value="notes"
              className="mt-0 min-h-0 flex-1 overflow-auto p-5"
            >
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <EventNotes
                  eventId={event.event_id}
                  canWrite={canWriteNotes}
                />
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function Fact({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-gray-500">
        <span className="text-gray-400">{icon}</span>
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}
