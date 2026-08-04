import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/shared/Fab";
import { EventsExplorer, type EventRow } from "@/components/events/EventsExplorer";
import { EventsToolbar } from "@/components/events/EventsToolbar";
import { hasFullAccess } from "@/constants/roles";
import { canCreateEvents, canImportEvents } from "@/constants/capabilities";
import type { UserContext } from "@/types/alumni";

type SP = {
  q?: string;
  /** Event type (case-insensitive exact). */
  type?: string;
  /** Event-date range (inclusive). */
  from?: string;
  to?: string;
  /** Sort order: date | upcoming | type. */
  sort?: string;
  /** Deep-link: auto-open this event's detail drawer on load. */
  event?: string;
};

interface EventOptions {
  types: string[];
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  // Deep-link target (?event=<id>) — open this event's drawer once the list
  // renders. Ignored if absent or non-numeric.
  const openId = sp.event && /^\d+$/.test(sp.event) ? Number(sp.event) : undefined;

  const filters = {
    q: sp.q ?? "",
    type: sp.type ?? "",
    from: sp.from ?? "",
    to: sp.to ?? "",
    sort: (sp.sort === "upcoming" || sp.sort === "type"
      ? sp.sort
      : "date") as "date" | "upcoming" | "type",
  };

  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("event_type", filters.type);
  if (filters.from) params.set("date_from", filters.from);
  if (filters.to) params.set("date_to", filters.to);
  if (filters.sort !== "date") params.set("sort", filters.sort);
  const qs = params.toString();

  let events: EventRow[] | null = null;
  let error: ApiError | null = null;
  let types: string[] = [];
  // Fetch the list and the filter-menu options (distinct event types)
  // concurrently; the options are non-critical, so a failure there just leaves
  // the dropdown with "All".
  const [listResult, optionsResult] = await Promise.allSettled([
    apiGet<EventRow[]>(qs ? `/events?${qs}` : "/events"),
    apiGet<EventOptions>("/events/options", {
      revalidate: 300,
      tags: ["events"],
    }),
  ]);
  if (listResult.status === "fulfilled") {
    events = listResult.value;
  } else {
    const e = listResult.reason;
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load events.");
  }
  if (optionsResult.status === "fulfilled") {
    types = optionsResult.value.types;
  }

  // Three DIFFERENT gates, deliberately not one flag (fa-web-api #378):
  //
  //   * canManageEvents / canWriteNotes — editing and deleting an event, its
  //     attendee roster, and discussion notes (#39). Still the `alumni.full`
  //     tier, so still a role check.
  //   * canCreate — POST /events, now the editable `events.create` CAPABILITY.
  //   * canImport — the bulk-upload wizard, now the editable `events.import`
  //     CAPABILITY.
  //
  // The last two must be read from `ctx.capabilities`, NOT from the role: an
  // engineer can grant either one to a role that isn't full_access, and a role
  // check would keep the button hidden from someone the backend would happily
  // let through (and vice versa). Fetch the caller's context once; default to
  // read-only if the account isn't provisioned. The backend re-enforces every
  // write regardless.
  let canManageEvents = false;
  let canWriteNotes = false;
  let canCreate = false;
  let canImport = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canManageEvents = hasFullAccess(ctx.roles);
    canWriteNotes = hasFullAccess(ctx.roles);
    canCreate = canCreateEvents(ctx.capabilities);
    canImport = canImportEvents(ctx.capabilities);
  } catch {
    canManageEvents = false;
    canWriteNotes = false;
    canCreate = false;
    canImport = false;
  }

  // "Add event" is the plain create form: an event needs no attendee list to
  // exist (#611), and creating one event is the common case. The bulk CSV
  // wizard sits beside it as the clearly-labelled secondary action, never the
  // default. Each is gated on its own capability (#378), so a user may see
  // one, both, or neither.
  return (
    <>
      <Topbar title="Events" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <EventsToolbar
          initial={filters}
          types={types}
          canCreate={canCreate}
          canImport={canImport}
        />

        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "Your account isn't provisioned yet"
                : "Couldn't load events"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </Card>
        ) : events && events.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            No events match your search.
          </Card>
        ) : (
          <EventsExplorer
            events={events!}
            initialOpenId={openId}
            canWriteNotes={canWriteNotes}
            canManageEvents={canManageEvents}
          />
        )}

        {/* Mobile FAB — Add event (the plain create form; an event needs no
            attendee list to exist, #611) with the bulk CSV import beneath it as
            the clearly separate, secondary action. Desktop keeps the equivalent
            pair of inline toolbar buttons. Each entry is gated on its own
            capability (#378). */}
        {canCreate || canImport ? (
          <Fab label="Add event">
            {canCreate ? (
              <Button asChild>
                <Link href="/events/new">Add event</Link>
              </Button>
            ) : null}
            {canImport ? (
              <Button asChild variant="secondary">
                <Link href="/events/import">Import events from CSV</Link>
              </Button>
            ) : null}
          </Fab>
        ) : null}
      </main>
    </>
  );
}
