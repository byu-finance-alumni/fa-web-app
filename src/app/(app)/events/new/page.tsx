import { Topbar } from "@/components/shell/Topbar";
import { EventForm } from "@/components/events/EventForm";
import { createEvent } from "../actions";

export default function NewEventPage() {
  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: "Add event" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <EventForm
          action={createEvent}
          submitLabel="Create event"
          cancelHref="/events"
        />
      </main>
    </>
  );
}
