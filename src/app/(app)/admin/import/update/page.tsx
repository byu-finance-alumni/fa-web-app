import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { readAuthContext } from "@/lib/auth-context";
import { canImportAlumni } from "@/constants/capabilities";
import { UpdateImportWizard } from "@/components/alumni/import/UpdateImportWizard";

/**
 * Bulk-UPDATE existing alumni from a CSV — its own Manage → Update menu item
 * (listed right after Import), so the round-trip (pick a class year → export →
 * edit → upload) has a direct entry point instead of being buried as a tile in
 * the Import hub. Gated on the `alumni.import` capability (fa-web-api #379);
 * the backend re-enforces it on every request. Roles without it are redirected
 * to the roster.

 * Note the cohort DOWNLOAD inside the wizard is gated separately server-side on
 * `alumni.export` — import and export are the two bulk doors and are granted
 * independently.
 *
 * The redirect answers a 401/403 only (#688). This screen overwrites existing
 * alumni rows in bulk, so an unreadable `/auth/context` leaves the flag false
 * and renders the error in place — neither opening the wizard on a guess nor
 * moving the user off the URL they asked for.
 */
export default async function UpdateAlumniPage() {
  let canUpdate = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    const ctx = auth.ctx;
    canUpdate = canImportAlumni(ctx.capabilities);
  }
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Import", href: "/admin/import" },
          { label: "Update" },
        ]}
      />
    );
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
