import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { isEngineer } from "@/constants/roles";
import { Topbar } from "@/components/shell/Topbar";
import { PreviewLauncher } from "@/components/engineer/PreviewLauncher";
import { Card } from "@/components/ui/card";
import { asPreviewRole, PREVIEW_COOKIE } from "@/lib/preview";
import type { PermissionMatrix } from "@/types/permissions";

/**
 * Engineer → Preview as role (#165). Pick a role and see the app the way that
 * role sees it (navigation + access), read-only, with a persistent exit banner.
 * The route group is engineer-gated; entering preview is audited server-side.
 */
export default async function PreviewPage() {
  // Role gate (defense-in-depth): preview-as-role is engineer-only. The
  // /engineer/* route group is already gated in engineer/layout.tsx; this
  // page-level check is belt-and-suspenders. Redirect non-engineers — and any
  // authed-but-unprovisioned user (getAuthContext throws → null) — to the
  // dashboard rather than rendering the launcher. The backend re-enforces it too.
  const gate = await getAuthContext().catch(() => null);
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");

  const store = await cookies();
  const current = asPreviewRole(store.get(PREVIEW_COOKIE)?.value);

  let matrix: PermissionMatrix | null = null;
  let error: ApiError | null = null;
  try {
    matrix = await apiGet<PermissionMatrix>("/engineer/permissions");
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load roles.");
  }

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Engineer", href: "/engineer" },
          { label: "Preview as role" },
        ]}
      />
      <main className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="max-w-2xl text-sm text-gray-500">
            Preview the app as another role to see what its navigation and access
            look like. You stay signed in as yourself — this only changes what the
            UI shows, and it’s read-only. A banner stays at the top while you
            preview, with a one-click exit.
          </p>
          {error ? (
            <Card className="p-10 text-center">
              <p className="text-sm font-semibold text-gray-900">
                {error.status === 403
                  ? "Engineer access required"
                  : "Couldn't load roles"}
              </p>
              <p className="mt-1 text-sm text-gray-500">{error.message}</p>
            </Card>
          ) : (
            <PreviewLauncher matrix={matrix!} current={current} />
          )}
        </div>
      </main>
    </>
  );
}
