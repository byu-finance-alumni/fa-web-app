import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/shared/Fab";
import { LoadError } from "@/components/shared/LoadError";
import { EventsExplorer, type EventRow } from "@/components/events/EventsExplorer";
import { EventsToolbar } from "@/components/events/EventsToolbar";
import {
  canCreateEvents,
  canImportEvents,
  canManageEvents as canManageEventsCap,
  canWriteNotes as canWriteNotesCap,
} from "@/constants/capabilities";
import { readAuthContext } from "@/lib/auth-context";

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
  //     attendee roster — now the editable `events.manage` CAPABILITY (#379).
  //   * canWriteNotes — discussion notes (#39), now the editable `notes.manage`
  //     CAPABILITY (#379). Split from event management because "may annotate"
  //     and "may delete the event" are different levels of trust.
  //   * canCreate — POST /events, the editable `events.create` CAPABILITY.
  //   * canImport — the bulk-upload wizard, the editable `events.import`
  //     CAPABILITY.
  //
  // All four are read from `ctx.capabilities`, NOT from the role: an engineer
  // can grant any of them to a role that isn't full_access, and a role check
  // would keep the button hidden from someone the backend would happily let
  // through (and vice versa). Fetch the caller's context once; default to
  // read-only if the account isn't provisioned. The backend re-enforces every
  // write regardless.
  //
  // "Isn't provisioned" is a 401/403 ANSWER, not any failure (#688). A context
  // call that 5xx'd tells us nothing about this account, and stripping Add
  // event / Import / the note box on that basis reads to the user as their
  // access being revoked. That case falls into `error` below and says so.
  let canManageEvents = false;
  let canWriteNotes = false;
  let canCreate = false;
  let canImport = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    const ctx = auth.ctx;
    canManageEvents = canManageEventsCap(ctx.capabilities);
    canWriteNotes = canWriteNotesCap(ctx.capabilities);
    canCreate = canCreateEvents(ctx.capabilities);
    canImport = canImportEvents(ctx.capabilities);
  } else if (auth.status === "unavailable" && !error) {
    error = new ApiError(auth.httpStatus ?? 0, "Failed to read your access.");
  }

  // "Add event" ALWAYS means the plain create form (#611). It used to prefer the
  // bulk-upload wizard whenever the user held `events.import`, which is how a
  // staff member with no attendee list ended up unable to create an event at
  // all: that screen refuses to proceed without a file. Creating one event is
  // the common case; importing a batch is the occasional one, so it gets its own
  // clearly-labelled secondary button instead of the primary label. The two are
  // independent capabilities, so a user may see either, both, or neither.
  const createHref = canCreate ? "/events/new" : null;
  const importHref = canImport ? "/events/import" : null;

  return (
    <>
      <Topbar title="Events" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <EventsToolbar
          initial={filters}
          types={types}
          createHref={createHref}
          importHref={importHref}
        />

        {error ? (
          <LoadError status={error.status} noun="events" />
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

        {/* Mobile FAB — the same pair of actions as the desktop toolbar, under
            the same capability gates: the plain create form first, bulk CSV
            import as the separate secondary action beneath it (#611). */}
        {createHref || importHref ? (
          <Fab label="Add event">
            {createHref ? (
              <Button asChild>
                <Link href={createHref}>Add event</Link>
              </Button>
            ) : null}
            {importHref ? (
              <Button asChild variant="secondary">
                <Link href={importHref}>Import events from CSV</Link>
              </Button>
            ) : null}
          </Fab>
        ) : null}
      </main>
    </>
  );
}
