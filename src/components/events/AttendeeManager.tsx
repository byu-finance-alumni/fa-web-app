"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import { clientGet } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  addAttendee,
  removeAttendee,
  exportEventAttendees,
} from "@/app/(app)/events/actions";
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
export function AttendeeManager({
  eventId,
  className = "mt-8",
}: {
  eventId: number;
  /** Wrapper Card classes. Defaults to the edit-page spacing (`mt-8`); the
   *  event detail sheet passes its own so the manager sits flush in its tab. */
  className?: string;
}) {
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

  // Download the roster as CSV (Name, Email, Net ID). The server action returns
  // the CSV text (full_access on the backend); we turn it into a Blob download.
  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    const result = await exportEventAttendees(eventId);
    setExporting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
    <Card className={cn(className)}>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Attendees</h3>
          <Badge variant="neutral" className="tabular-nums">
            {attendees.length}
          </Badge>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={exporting || attendees.length === 0}
            className="ml-auto"
          >
            {exporting ? "Downloading…" : "Download attendees (CSV)"}
          </Button>
        </div>

        {/* Add-attendee search */}
        <div ref={rootRef} className="relative mb-4">
          <div className="flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 focus-within:border-brand-blue-600 focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1">
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
              className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
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
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-card"
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
                            <Badge variant="neutral">Added</Badge>
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
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {attendees.map((a) => (
              <li
                key={a.alumni_id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/alumni/${a.alumni_id}`}
                    className="block truncate text-sm font-medium text-gray-900 hover:text-brand-blue-600 hover:underline"
                  >
                    {a.name}
                  </Link>
                  <p className="truncate text-xs text-gray-500">
                    {[
                      a.graduation_year ? `Class of ${a.graduation_year}` : null,
                      a.attendance_status,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => handleRemove(a)}
                  disabled={pending.has(a.alumni_id)}
                  aria-label={`Remove ${a.name}`}
                  className="h-8 w-8 shrink-0 text-gray-500 hover:text-danger-600"
                >
                  {pending.has(a.alumni_id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <X className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
