import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { getAuthContext } from "@/lib/auth-context";
import { hasFullAccess } from "@/constants/roles";
import { ImportWizard } from "@/components/alumni/import/ImportWizard";

/**
 * Friends CSV bulk-import screen (#294). Same wizard as the alumni import, scoped
 * with kind="friend" so the backend uses the friend template (no grad/education
 * columns) and stamps imported rows is_alumni=false. Full access and up — the
 * same gate the alumni import page uses, and the backend re-enforces it on every
 * request. Lower roles are redirected back to the roster rather than shown a
 * dead-end page.
 */
export default async function ImportFriendsPage() {
  let canImport = false;
  try {
    const ctx = await getAuthContext();
    canImport = hasFullAccess(ctx.roles);
  } catch {
    canImport = false;
  }
  if (!canImport) redirect("/friends");

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Friends", href: "/friends" },
          { label: "Import CSV" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <ImportWizard kind="friend" />
      </main>
    </>
  );
}
