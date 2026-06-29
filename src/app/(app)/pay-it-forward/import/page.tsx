import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { isUserAdmin } from "@/constants/roles";
import { DonationsImportWizard } from "@/components/donations/DonationsImportWizard";

/**
 * Donations CSV bulk-import screen (#161). Super admin only — mirrors the backend
 * require_super_admin on the donations import endpoints. Lower roles are
 * redirected back to the tab. The backend re-enforces the gate on every request.
 */
export default async function ImportDonationsPage() {
  let canImport = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canImport = isUserAdmin(ctx.roles);
  } catch {
    canImport = false;
  }
  if (!canImport) redirect("/pay-it-forward");

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Pay It Forward", href: "/pay-it-forward" },
          { label: "Import CSV" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <DonationsImportWizard />
      </main>
    </>
  );
}
