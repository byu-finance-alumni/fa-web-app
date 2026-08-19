import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { readAuthContext } from "@/lib/auth-context";
import { isUserAdmin } from "@/constants/roles";
import { DonationsImportWizard } from "@/components/donations/DonationsImportWizard";

/**
 * Donations CSV bulk-import screen (#161). Super admin only — mirrors the backend
 * require_super_admin on the donations import endpoints. Lower roles are
 * redirected back to the tab. The backend re-enforces the gate on every request.
 *
 * This is the narrowest gate in the app and the one where guessing costs most:
 * donation amounts against named alumni. So the flag defaults to false, is
 * raised only on a verified-success context read, and an unreadable context
 * (5xx / timeout / unreachable) renders the error rather than either opening
 * the wizard or bouncing to a tab that is failing for the same reason (#688).
 */
export default async function ImportDonationsPage() {
  let canImport = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    canImport = isUserAdmin(auth.ctx.roles);
  }
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Pay It Forward", href: "/pay-it-forward" },
          { label: "Import CSV" },
        ]}
      />
    );
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
