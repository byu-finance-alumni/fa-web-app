import { apiGet, ApiError } from "@/lib/api";
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
