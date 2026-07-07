import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { getAuthContext } from "@/lib/auth-context";
import { hasFullAccess } from "@/constants/roles";
import { ImportWizard } from "@/components/alumni/import/ImportWizard";

/**
 * CSV bulk-import screen, under the Admin dropdown. Full access and up
 * (engineer / super_admin / full_access) — the same gate the Admin → "Import
 * CSV" nav item uses, and the backend enforces it too (all three import
 * endpoints require full access). View-only and student users are redirected
 * back to the list rather than shown a dead-end page.
 */
export default async function ImportAlumniPage() {
  let canImport = false;
  try {
    const ctx = await getAuthContext();
    canImport = hasFullAccess(ctx.roles);
  } catch {
    canImport = false;
  }
  if (!canImport) redirect("/alumni");

  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Import CSV" }]} />
      <main className="flex-1 overflow-auto p-6">
        <ImportWizard />
      </main>
    </>
  );
}
