import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { Topbar } from "@/components/shell/Topbar";
import { SupportContactsManager } from "@/components/admin/SupportContactsManager";
import type { SupportContact } from "@/types/support";
import { isEngineer } from "@/constants/roles";
import { LoadError } from "@/components/shared/LoadError";

/**
 * Engineer-only editor for the support contacts shown to signed-in users on the
 * in-app error screen. The page is gated to engineers in the UI (the sidebar
 * link is engineer-only too) and the backend re-enforces every write via
 * RequireEngineer. Reading the list uses the view-access GET.
 */
export default async function SupportContactsPage() {
  // Role gate (defense-in-depth): support contacts are engineer-only. The
  // /engineer/* route group is already gated in engineer/layout.tsx; this
  // page-level check is belt-and-suspenders. Redirect non-engineers — and any
  // authed-but-unprovisioned user (getAuthContext throws → null) — to the
  // dashboard rather than rendering a dead-end "access required" shell. The
  // backend re-enforces RequireEngineer on every write.
  const gate = await getAuthContext().catch(() => null);
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");

  let contacts: SupportContact[] = [];
  let error: ApiError | null = null;
  try {
    contacts = await apiGet<SupportContact[]>("/support-contacts");
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load contacts.");
  }

  return (
    <>
      <Topbar title="Support contacts" />
      <main className="flex-1 overflow-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-gray-500">
          Shown to signed-in users on the error screen so they know who to
          contact. These are <span className="font-medium text-gray-700">not</span>{" "}
          shown on the public sign-in page.
        </p>
        {error ? (
          <LoadError status={error.status} noun="the support contacts" />
        ) : (
          <SupportContactsManager contacts={contacts} />
        )}
      </main>
    </>
  );
}
