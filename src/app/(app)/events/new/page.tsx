import { Topbar } from "@/components/shell/Topbar";
import { EventForm } from "@/components/events/EventForm";
import { createEvent } from "../actions";

export default function NewEventPage() {
  return (
    <>
      <Topbar title="Add event" />
      <main className="flex-1 overflow-auto p-6">
        <h2 className="mb-4 text-2xl font-semibold text-gray-900">Add event</h2>
        <EventForm
          action={createEvent}
          submitLabel="Create event"
          cancelHref="/events"
        />
      </main>
    </>
  );
}
