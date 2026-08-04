import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { EventForm } from "@/components/events/EventForm";
import { apiGet } from "@/lib/api";
import { canCreateEvents } from "@/constants/capabilities";
import type { UserContext } from "@/types/alumni";
import { getEventTypeOptions } from "../vocab";
import { createEvent } from "../actions";

export default async function NewEventPage() {
  // Creating an event is gated on the editable `events.create` CAPABILITY
  // (fa-web-api #378), which the backend enforces on POST /events. Read the
  // capability, not the role: it is seeded to full_access and up, but an
  // engineer can grant it to a narrower role from the permission editor, and a
  // role check here would bounce someone the backend would accept. Anyone
  // without it is sent to the read-only events list rather than shown a form
  // that 403s on submit. redirect() runs outside the try/catch (it throws a
  // control-flow signal a catch would swallow). Backend is the source of truth;
  // this is UX only.
  let canCreate = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canCreate = canCreateEvents(ctx.capabilities);
  } catch {
    /* not provisioned / context error → treat as no create access */
  }
  if (!canCreate) redirect("/events");

  const eventTypeOptions = await getEventTypeOptions();
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
          eventTypeOptions={eventTypeOptions}
        />
      </main>
    </>
  );
}
