import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";

interface EventRow {
  event_id: number;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  event_location: string | null;
  attendance_count: number;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function EventsPage() {
  let events: EventRow[] | null = null;
  let error: ApiError | null = null;
  try {
    events = await apiGet<EventRow[]>("/events");
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load events.");
  }

  return (
    <>
      <Topbar title="Events">
        <TopbarSearch />
      </Topbar>
      <main className="flex-1 overflow-auto p-6">
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
            No events yet.
          </div>
        ) : (
          <>
          {/* Mobile: stacked cards */}
          <div className="space-y-2 md:hidden">
            {events!.map((e) => (
              <div
                key={e.event_id}
                className="rounded-xl border border-gray-300 bg-white p-3"
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
              </div>
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
                {events!.map((e) => (
                  <tr
                    key={e.event_id}
                    className="border-b border-gray-300 last:border-0"
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
          </>
        )}
      </main>
    </>
  );
}
