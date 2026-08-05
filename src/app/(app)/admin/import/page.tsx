import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { getAuthContext } from "@/lib/auth-context";
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
 */
export default async function ImportHubPage() {
  let canImport = false;
  let canDonations = false;
  try {
    const ctx = await getAuthContext();
    canImport = canImportAlumni(ctx.capabilities);
    canDonations = isUserAdmin(ctx.roles);
  } catch {
    canImport = false;
    canDonations = false;
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
