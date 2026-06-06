"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { clientGet } from "@/lib/api-client";

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
export function EventsExplorer({ events }: { events: EventRow[] }) {
  const [selected, setSelected] = useState<EventRow | null>(null);

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="space-y-2 md:hidden">
        {events.map((e) => (
          <button
            key={e.event_id}
            type="button"
            onClick={() => setSelected(e)}
            className="block w-full rounded-xl border border-gray-300 bg-white p-3 text-left hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-gray-900">{e.event_name}</p>
              {e.event_type ? (
                <span className="shrink-0 rounded-md bg-brand-blue-50 px-2 py-0.5 text-xs font-medium text-brand-blue-600">
                  {e.event_type}
                </span>
              ) : null}
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
      <div className="hidden overflow-hidden rounded-xl border border-gray-300 bg-white md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Event</th>
              <th className="w-44 px-4 py-3">Type</th>
              <th className="w-36 px-4 py-3">Date</th>
              <th className="w-44 px-4 py-3">Location</th>
              <th className="w-32 px-4 py-3">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr
                key={e.event_id}
                onClick={() => setSelected(e)}
                className="cursor-pointer border-b border-gray-300 last:border-0 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {e.event_name}
                </td>
                <td className="px-4 py-3">
                  {e.event_type ? (
                    <span className="rounded-md bg-brand-blue-50 px-2 py-0.5 text-xs font-medium text-brand-blue-600">
                      {e.event_type}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {formatDate(e.event_date)}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {e.event_location ?? "—"}
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums text-gray-900">
                  {e.attendance_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <EventDrawer event={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------------- drawer -- */

function EventDrawer({
  event,
  onClose,
}: {
  event: EventRow;
  onClose: () => void;
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
        <div className="flex items-start justify-between gap-3 border-b border-gray-300 bg-white p-5">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-semibold text-gray-900">
              {event.event_name}
            </h3>
            <p className="text-sm text-gray-500">
              {[formatDate(event.event_date), event.event_location]
                .filter((x) => x && x !== "—")
                .join(" · ") || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5">
          {/* Facts */}
          <div className="rounded-xl border border-gray-300 bg-white p-4">
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
            <div className="h-24 animate-pulse rounded-xl border border-gray-300 bg-white" />
          ) : detail?.event_notes ? (
            <div className="rounded-xl border border-gray-300 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Description
              </p>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {detail.event_notes}
              </p>
            </div>
          ) : null}

          {/* Attendees */}
          <div className="rounded-xl border border-gray-300 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Attendees
            </p>
            {loading ? (
              <p className="py-3 text-sm text-gray-400">Loading…</p>
            ) : error ? (
              <p className="py-3 text-sm text-gray-400">
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
              <p className="py-3 text-sm text-gray-400">No attendees recorded.</p>
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
