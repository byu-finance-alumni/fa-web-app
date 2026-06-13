import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { ImportWizard } from "@/components/alumni/import/ImportWizard";

/**
 * CSV bulk-import screen. Full-access / super-admin only — the same gate the
 * "Import CSV" toolbar button uses, and the backend enforces it too (all three
 * import endpoints require full access). View-only users are redirected back to
 * the list rather than shown a dead-end page.
 */
export default async function ImportAlumniPage() {
  let canImport = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canImport =
      ctx.roles?.some((r) => r === "full_access" || r === "super_admin") ??
      false;
  } catch {
    canImport = false;
  }
  if (!canImport) redirect("/alumni");

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: "Import CSV" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <ImportWizard />
      </main>
    </>
  );
}
