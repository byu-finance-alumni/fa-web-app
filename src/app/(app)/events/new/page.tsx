import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { EventForm } from "@/components/events/EventForm";
import { apiGet } from "@/lib/api";
import { hasFullAccess } from "@/constants/roles";
import type { UserContext } from "@/types/alumni";
import { getEventTypeOptions } from "../vocab";
import { createEvent } from "../actions";

export default async function NewEventPage() {
  // Creating events requires full_access — mirrors backend require_full_access
  // on POST /events. view_only ("Professor") users who navigate here directly
  // are bounced to the read-only events list rather than shown a create form the
  // backend would 403 on submit. redirect() runs outside the try/catch (it
  // throws a control-flow signal a catch would swallow). Backend is the source
  // of truth; this is UX only.
  let canManageEvents = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canManageEvents = hasFullAccess(ctx.roles);
  } catch {
    /* not provisioned / context error → treat as no manage access */
  }
  if (!canManageEvents) redirect("/events");

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
