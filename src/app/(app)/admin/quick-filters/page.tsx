import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { QuickFiltersManager } from "@/components/admin/QuickFiltersManager";
import { Card } from "@/components/ui/card";
import type { DashboardPreset } from "@/types/dashboardPresets";
import type { UserContext } from "@/types/alumni";
import { ROLE } from "@/constants/roles";

/**
 * Engineer / super-admin editor for the dashboard quick-filter presets shown on
 * the Quick search tab. Gated in the UI (the sidebar link is super-admin+ only)
 * and re-enforced by the backend via RequireSuperAdmin on every write. Reading
 * the list uses the view-access GET /dashboard/presets.
 */
export default async function QuickFiltersPage() {
  let canManage = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canManage =
      ctx.roles?.some(
        (r) => r === ROLE.ENGINEER || r === ROLE.SUPER_ADMIN,
      ) ?? false;
  } catch {
    /* fall through to the access-required screen */
  }

  if (!canManage) {
    return (
      <>
        <Topbar title="Quick filters" />
        <main className="flex-1 overflow-auto p-6">
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              Admin access required
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Only an engineer or super admin can manage dashboard quick filters.
            </p>
          </Card>
        </main>
      </>
    );
  }

  let presets: DashboardPreset[] = [];
  let error: ApiError | null = null;
  try {
    presets = await apiGet<DashboardPreset[]>("/dashboard/presets");
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load presets.");
  }

  return (
    <>
      <Topbar title="Quick filters" />
      <main className="flex-1 overflow-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-gray-500">
          The one-click presets shown on the dashboard’s{" "}
          <span className="font-medium text-gray-700">Quick search</span> tab.
          Each is a label plus a relative in-app link (e.g.{" "}
          <span className="font-mono text-gray-700">/alumni?cfa=1&amp;state=UT</span>
          ). Lower order numbers show first.
        </p>
        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              Couldn’t load quick filters
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </Card>
        ) : (
          <QuickFiltersManager presets={presets} />
        )}
      </main>
    </>
  );
}
