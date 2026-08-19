import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { readAuthContext } from "@/lib/auth-context";
import { isUserAdmin } from "@/constants/roles";
import { canImportAlumni } from "@/constants/capabilities";
import { ImportHub } from "@/components/alumni/import/ImportHub";

/**
 * Import hub (#401), under the Admin dropdown. The user first picks an import
 * TYPE — CSV Alumni, CSV Friends, Photos, or Pay It Forward — then the matching
 * wizard renders inline. Reaching the page needs the `alumni.import` capability
 * (fa-web-api #379 — read from the capability list, NOT a role check, so an
 * engineer who grants importing to another role actually opens this page); the
 * Pay It Forward option is additionally limited to super_admin, matching the
 * donations import gate. Every gate is
 * re-enforced by the backend on each request. View-only and student users are
 * redirected back to the list rather than shown a dead-end page.
 *
 * BOTH flags default to false and are raised only on a verified-success read
 * (#688). The redirect is reserved for a 401/403 — the backend's own answer. An
 * unreadable context does not redirect and does not render: this hub is the
 * front door to every bulk write in the app, so "we could not check" resolves
 * to an explicit error, never to the door.
 */
export default async function ImportHubPage() {
  let canImport = false;
  let canDonations = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    const ctx = auth.ctx;
    canImport = canImportAlumni(ctx.capabilities);
    canDonations = isUserAdmin(ctx.roles);
  }
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[{ label: "Admin" }, { label: "Import" }]}
      />
    );
  }
  if (!canImport) redirect("/alumni");

  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Import" }]} />
      <main className="flex-1 overflow-auto p-6">
        <ImportHub canFullAccess={canImport} canDonations={canDonations} />
      </main>
    </>
  );
}
