import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { hasFullAccess } from "@/constants/roles";
import { EventsImportWizard } from "@/components/events/import/EventsImportWizard";

/**
 * Events CSV bulk-import screen (#156). Full access and up — mirrors the backend
 * require_full_access on the events import endpoints. view_only ("Professor") and
 * student users are redirected back to the events list rather than shown a
 * dead-end page. The backend re-enforces the gate on every request.
 */
export default async function ImportEventsPage() {
  let canImport = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canImport = hasFullAccess(ctx.roles);
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
