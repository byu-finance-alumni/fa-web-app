import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { isEngineer } from "@/constants/roles";
import { Topbar } from "@/components/shell/Topbar";
import { PermissionEditor } from "@/components/engineer/PermissionEditor";
import { Card } from "@/components/ui/card";
import type { PermissionMatrix } from "@/types/permissions";

/**
 * Engineer → Permissions (#164). The editable role × capability matrix. The
 * route group is engineer-gated (engineer/layout.tsx) and the underlying
 * endpoints re-enforce it. Reads the live config from GET /engineer/permissions.
 */
export default async function PermissionsPage() {
  // Role gate (defense-in-depth): the permission editor is engineer-only. The
  // /engineer/* route group is already gated in engineer/layout.tsx; this
  // page-level check is belt-and-suspenders. Redirect non-engineers — and any
  // authed-but-unprovisioned user (getAuthContext throws → null) — to the
  // dashboard rather than rendering the editor. The backend re-enforces it too.
  const gate = await getAuthContext().catch(() => null);
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");

  let matrix: PermissionMatrix | null = null;
  let error: ApiError | null = null;
  try {
    matrix = await apiGet<PermissionMatrix>("/engineer/permissions");
  } catch (e) {
    error =
      e instanceof ApiError ? e : new ApiError(0, "Failed to load permissions.");
  }

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Engineer", href: "/engineer" }, { label: "Permissions" }]}
      />
      <main className="min-h-0 flex-1 overflow-auto p-6">
        <h1 className="sr-only">Permissions</h1>
        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "Engineer access required"
                : "Couldn't load permissions"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </Card>
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            <div>
              <p className="max-w-2xl text-sm text-gray-500">
                Toggle what each role can do. Changes take effect immediately and
                are enforced by the backend on every request — the engineer
                always keeps every capability, so its column is locked. The
                Engineer console capability can’t be granted to another role.
              </p>
            </div>
            <Card className="p-2 sm:p-4">
              <PermissionEditor initial={matrix!} />
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
