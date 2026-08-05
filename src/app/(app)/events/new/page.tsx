import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { EventWizard } from "@/components/events/EventWizard";
import { apiGet } from "@/lib/api";
import { canCreateEvents, canImportEvents } from "@/constants/capabilities";
import { hasFullAccess } from "@/constants/roles";
import type { UserContext } from "@/types/alumni";
import { getEventTypeOptions } from "../vocab";
import { createEvent, previewEvent } from "../actions";

/**
 * Add event — the plain create form, and the destination of every "Add event"
 * button (#611).
 *
 * No attendee list is required to get here or to finish: the wizard creates the
 * event on its own and the roster is attached afterwards. Bulk CSV import lives
 * at /events/import as its own clearly-labelled action.
 */
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
  // Separate, coarser gate: the attendee-match upload is guarded by
  // require_full_access on the backend, so "take me to the upload next" is only
  // offered to someone that screen will actually let in. It never gates creating
  // the event itself — an event with no attendees is the common case.
  let canUploadAttendees = false;
  let canImport = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canCreate = canCreateEvents(ctx.capabilities);
    canImport = canImportEvents(ctx.capabilities);
    canUploadAttendees = hasFullAccess(ctx.roles);
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
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <EventWizard
          action={createEvent}
          previewAction={previewEvent}
          eventTypeOptions={eventTypeOptions}
          cancelHref="/events"
          canUploadAttendees={canUploadAttendees}
          importHref={canImport ? "/events/import" : null}
        />
      </main>
    </>
  );
}
