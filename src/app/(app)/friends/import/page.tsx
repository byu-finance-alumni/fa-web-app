import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { readAuthContext } from "@/lib/auth-context";
import { canImportAlumni } from "@/constants/capabilities";
import { ImportWizard } from "@/components/alumni/import/ImportWizard";

/**
 * Friends CSV bulk-import screen (#294). Same wizard as the alumni import, scoped
 * with kind="friend" so the backend uses the friend template (no grad/education
 * columns) and stamps imported rows is_alumni=false. Gated on the
 * `alumni.import` capability (fa-web-api #379) — the same gate the alumni import
 * page uses, and the backend re-enforces it on every request. Roles without it
 * are redirected back to the roster rather than shown a dead-end page.
 *
 * As on every gate in #688, that redirect is the answer to a 401/403 and
 * nothing else. An unreadable context leaves the flag false and renders the
 * error here — a bulk write is not something to open on an unverified guess.
 */
export default async function ImportFriendsPage() {
  let canImport = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    const ctx = auth.ctx;
    canImport = canImportAlumni(ctx.capabilities);
  }
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Friends", href: "/friends" },
          { label: "Import CSV" },
        ]}
      />
    );
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
