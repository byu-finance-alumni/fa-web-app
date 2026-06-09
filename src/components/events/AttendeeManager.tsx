"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X, Users } from "lucide-react";
import { clientGet } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { addAttendee, removeAttendee } from "@/app/(app)/events/actions";
import type { Alumni, AlumniPage } from "@/types/alumni";

// Mirror the topbar typeahead ergonomics: 2 chars is fine here (a focused,
// in-page picker), debounced, capped at 8 matches per the spec.
const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;
const MAX_MATCHES = 8;

interface Attendee {
  alumni_id: number;
  name: string;
  graduation_year: number | null;
  attendance_status: string | null;
}

function displayName(a: Alumni): string {
  const first = a.preferred_first_name ?? a.first_name ?? "";
  return [first, a.last_name].filter(Boolean).join(" ") || "—";
}

/**
 * Attendance management for the event edit flow. Lists the event's current
 * attendees (fetched client-side) with a remove button each, and a debounced
 * alumni search box that adds the picked alumni as an attendee. Mutations go
 * through the addAttendee/removeAttendee server actions; success/failure is
 * surfaced via the shared toast.
 */
export function AttendeeManager({ eventId }: { eventId: number }) {
  const { toast } = useToast();

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // alumni_id currently being added/removed (disables its control).
  const [pending, setPending] = useState<Set<number>>(new Set());

  // Search state (typeahead).
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [matches, setMatches] = useState<Alumni[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  // Monotonic sequence guards against out-of-order responses.
  const seqRef = useRef(0);

  // Initial + refresh load of the attendee list.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    clientGet<Attendee[]>(`/events/${eventId}/attendees`)
      .then((rows) => !cancelled && setAttendees(rows))
      .catch(() => !cancelled && setLoadError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Debounced live alumni search.
  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN_CHARS) {
      seqRef.current++;
      setMatches([]);
      setOpen(false);
      setSearching(false);
      setSearchFailed(false);
      return;
    }
    setSearching(true);
    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      try {
        const page = await clientGet<AlumniPage>(
          `/alumni?q=${encodeURIComponent(term)}&limit=${MAX_MATCHES}&offset=0`,
        );
        if (seq !== seqRef.current) return;
        setMatches(page.items);
        setSearchFailed(false);
        setOpen(true);
      } catch {
        if (seq !== seqRef.current) return;
        setMatches([]);
        setSearchFailed(true);
        setOpen(true);
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function setPendingFor(id: number, on: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleAdd(a: Alumni) {
    if (pending.has(a.alumni_id)) return;
    setOpen(false);
    setQ("");
    setMatches([]);
    setPendingFor(a.alumni_id, true);
    const result = await addAttendee(eventId, a.alumni_id);
    setPendingFor(a.alumni_id, false);
    if (result.ok) {
      // Optimistic local insert, kept sorted by last/first to match the API.
      const added: Attendee = {
        alumni_id: a.alumni_id,
        name: displayName(a),
        graduation_year: a.graduation_year,
        attendance_status: null,
      };
      setAttendees((prev) =>
        prev.some((p) => p.alumni_id === a.alumni_id)
          ? prev
          : [...prev, added].sort((x, y) => x.name.localeCompare(y.name)),
      );
      toast.success(`Added ${added.name}.`);
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemove(att: Attendee) {
    if (pending.has(att.alumni_id)) return;
    setPendingFor(att.alumni_id, true);
    const result = await removeAttendee(eventId, att.alumni_id);
    setPendingFor(att.alumni_id, false);
    if (result.ok) {
      setAttendees((prev) =>
        prev.filter((p) => p.alumni_id !== att.alumni_id),
      );
      toast.success(`Removed ${att.name}.`);
    } else {
      toast.error(result.error);
    }
  }

  const alreadyAdded = new Set(attendees.map((a) => a.alumni_id));

  return (
    <section className="mt-8 rounded-xl border border-gray-300 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-brand-blue-600" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-gray-900">Attendees</h3>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-700">
          {attendees.length}
        </span>
      </div>

      {/* Add-attendee search */}
      <div ref={rootRef} className="relative mb-4">
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-brand-blue-600 focus-within:ring-1 focus-within:ring-brand-blue-600">
          <Search
            className="h-4 w-4 shrink-0 text-gray-500"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => {
              if (matches.length > 0 || searchFailed) setOpen(true);
            }}
            placeholder="Add attendee — search alumni…"
            aria-label="Search alumni to add as attendee"
            autoComplete="off"
            className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
          />
          {searching && (
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-gray-500"
              aria-hidden="true"
            />
          )}
        </div>

        {open && (
          <ul
            role="listbox"
            aria-label="Alumni matches"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded-lg border border-gray-300 bg-white py-1 shadow-lg"
          >
            {searchFailed ? (
              <li className="px-3 py-2 text-sm text-gray-500">
                Couldn&rsquo;t load matches. Try again.
              </li>
            ) : matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">
                No alumni match &ldquo;{q.trim()}&rdquo;
              </li>
            ) : (
              matches.map((a) => {
                const added = alreadyAdded.has(a.alumni_id);
                return (
                  <li key={a.alumni_id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      disabled={added || pending.has(a.alumni_id)}
                      onClick={() => handleAdd(a)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="truncate font-medium text-gray-900">
                        {displayName(a)}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
                        {added ? (
                          <span className="rounded-md border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">
                            Added
                          </span>
                        ) : a.graduation_year ? (
                          `Class of ${a.graduation_year}`
                        ) : (
                          ""
                        )}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {/* Current attendees */}
      {loading ? (
        <p className="py-3 text-sm text-gray-400">Loading attendees…</p>
      ) : loadError ? (
        <p className="py-3 text-sm text-gray-400">
          Couldn&rsquo;t load attendees.
        </p>
      ) : attendees.length === 0 ? (
        <p className="py-3 text-sm text-gray-400">
          No attendees yet. Search above to add the first one.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-300">
          {attendees.map((a) => (
            <li
              key={a.alumni_id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {a.name}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {[
                    a.graduation_year ? `Class of ${a.graduation_year}` : null,
                    a.attendance_status,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(a)}
                disabled={pending.has(a.alumni_id)}
                aria-label={`Remove ${a.name}`}
                className="shrink-0 rounded-lg border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending.has(a.alumni_id) ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <X className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
