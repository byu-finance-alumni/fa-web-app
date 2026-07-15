import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { getAuthContext } from "@/lib/auth-context";
import { hasFullAccess, isUserAdmin } from "@/constants/roles";
import { ImportHub } from "@/components/alumni/import/ImportHub";

/**
 * Import hub (#401), under the Admin dropdown. The user first picks an import
 * TYPE — CSV Alumni, CSV Friends, Photos, or Pay It Forward — then the matching
 * wizard renders inline. Full access and up may reach the page (mirroring the
 * Admin → "Import" nav item); the Pay It Forward option is additionally
 * limited to super_admin, matching the donations import gate. Every gate is
 * re-enforced by the backend on each request. View-only and student users are
 * redirected back to the list rather than shown a dead-end page.
 */
export default async function ImportHubPage() {
  let canFullAccess = false;
  let canDonations = false;
  try {
    const ctx = await getAuthContext();
    canFullAccess = hasFullAccess(ctx.roles);
    canDonations = isUserAdmin(ctx.roles);
  } catch {
    canFullAccess = false;
    canDonations = false;
  }
  if (!canFullAccess) redirect("/alumni");

  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Import" }]} />
      <main className="flex-1 overflow-auto p-6">
        <ImportHub canFullAccess={canFullAccess} canDonations={canDonations} />
      </main>
    </>
  );
}
