import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { EventForm } from "@/components/events/EventForm";
import { apiGet, ApiError } from "@/lib/api";
import { updateEvent } from "../../actions";

interface EventDetail {
  event_id: number;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  event_location: string | null;
  event_notes: string | null;
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let event: EventDetail;
  try {
    event = await apiGet<EventDetail>(`/events/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const action = updateEvent.bind(null, event.event_id);

  return (
    <>
      <Topbar title="Edit event" />
      <main className="flex-1 overflow-auto p-6">
        <h2 className="mb-4 text-2xl font-semibold text-gray-900">Edit event</h2>
        <EventForm
          action={action}
          submitLabel="Save changes"
          cancelHref="/events"
          initialValues={{
            event_name: event.event_name,
            event_type: event.event_type,
            event_date: event.event_date,
            event_location: event.event_location,
            event_notes: event.event_notes,
          }}
        />
      </main>
    </>
  );
}
