import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { getAuthContext } from "@/lib/auth-context";
import { hasFullAccess } from "@/constants/roles";
import { UpdateImportWizard } from "@/components/alumni/import/UpdateImportWizard";

/**
 * Bulk-UPDATE existing alumni from a CSV — its own Manage → Update menu item
 * (listed right after Import), so the round-trip (pick a class year → export →
 * edit → upload) has a direct entry point instead of being buried as a tile in
 * the Import hub. Full access and up may reach it; the backend re-enforces the
 * gate on every request. Lower roles are redirected to the roster.
 */
export default async function UpdateAlumniPage() {
  let canUpdate = false;
  try {
    const ctx = await getAuthContext();
    canUpdate = hasFullAccess(ctx.roles);
  } catch {
    canUpdate = false;
  }
  if (!canUpdate) redirect("/alumni");

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Import", href: "/admin/import" },
          { label: "Update" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <UpdateImportWizard />
      </main>
    </>
  );
}
