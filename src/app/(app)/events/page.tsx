import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { EventsExplorer, type EventRow } from "@/components/events/EventsExplorer";
import { EventsToolbar } from "@/components/events/EventsToolbar";

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

  return (
    <>
      <Topbar title="Events" />
      <main className="flex-1 overflow-auto p-6">
        <EventsToolbar initial={filters} types={types} />

        {error ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">
              {error.status === 403
                ? "Your account isn't provisioned yet"
                : "Couldn't load events"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </div>
        ) : events && events.length === 0 ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No events match your search.
          </div>
        ) : (
          <EventsExplorer events={events!} initialOpenId={openId} />
        )}
      </main>
    </>
  );
}
