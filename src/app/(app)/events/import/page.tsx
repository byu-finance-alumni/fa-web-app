import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { canImportEvents } from "@/constants/capabilities";
import { EventsImportWizard } from "@/components/events/import/EventsImportWizard";

/**
 * Events CSV bulk-import screen (#156). Gated on the editable `events.import`
 * CAPABILITY (fa-web-api #378), which the backend enforces on all three legs of
 * the flow — template, preview, and commit. Read the capability, not the role:
 * `events.import` is seeded to full_access and up but an engineer can grant it
 * to any role, and a role check would bounce someone the backend would let in.
 * Anyone without it is redirected back to the events list rather than shown a
 * dead-end page.
 */
export default async function ImportEventsPage() {
  let canImport = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canImport = canImportEvents(ctx.capabilities);
  } catch {
    canImport = false;
  }
  if (!canImport) redirect("/events");

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: "Import CSV" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <EventsImportWizard />
      </main>
    </>
  );
}
