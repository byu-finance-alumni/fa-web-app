import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { EventForm } from "@/components/events/EventForm";
import { AttendeeManager } from "@/components/events/AttendeeManager";
import { apiGet, ApiError } from "@/lib/api";
import { getEventTypeOptions } from "../../vocab";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  let event: EventDetail;
  try {
    event = await apiGet<EventDetail>(`/events/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const action = updateEvent.bind(null, event.event_id);
  const eventTypeOptions = await getEventTypeOptions();

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: event.event_name || "Event" },
          { label: "Edit" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        {created ? (
          <p className="mb-4 rounded-lg border border-brand-blue-300 bg-brand-blue-50 px-4 py-3 text-sm text-navy-800">
            Event created. Add attendees below.
          </p>
        ) : null}
        <EventForm
          action={action}
          submitLabel="Save changes"
          cancelHref="/events"
          eventTypeOptions={eventTypeOptions}
          initialValues={{
            event_name: event.event_name,
            event_type: event.event_type,
            event_date: event.event_date,
            event_location: event.event_location,
            event_notes: event.event_notes,
          }}
        />
        <AttendeeManager eventId={event.event_id} />
      </main>
    </>
  );
}
