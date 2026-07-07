import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { UsersAdmin, type AdminUser } from "@/components/admin/UsersAdmin";
import { RoleCapabilitiesTable } from "@/components/admin/RoleCapabilitiesTable";
import { Card } from "@/components/ui/card";
import type { PermissionMatrix } from "@/types/permissions";
import { ROLE, isUserAdmin } from "@/constants/roles";

type SP = { q?: string };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // Role gate (defense-in-depth): user administration is USER_ADMIN-only
  // (engineer / super_admin). Redirect anyone else — and any authed-but-
  // unprovisioned user (getAuthContext throws → null) — to the dashboard rather
  // than rendering a dead-end "access required" shell. The backend still
  // re-enforces the guard on every /admin/* endpoint. getAuthContext is
  // React-cached, so the read below in Promise.allSettled dedupes with this one.
  const gate = await getAuthContext().catch(() => null);
  if (!gate || !isUserAdmin(gate.roles)) redirect("/dashboard");

  // The Users search is mirrored into the URL (?q=) so it survives back-nav and
  // is shareable (#259); read it here and seed the client list from it.
  const sp = await searchParams;
  const initialQ = typeof sp.q === "string" ? sp.q : "";

  let users: AdminUser[] | null = null;
  let error: ApiError | null = null;
  let currentUserId: number | null = null;
  // Whether the signed-in admin is an engineer — gates granting/removing the
  // engineer role in the UI (backend enforces the same ceiling).
  let canAssignEngineer = false;

  // Fetch the three independent reads together instead of serially (#254): the
  // user list, the signed-in admin's context (deduped with the layout via
  // getAuthContext), and the role-capabilities config. Each degrades on its own —
  // only a failed user list blanks the page.
  const [usersResult, ctxResult, capabilitiesResult] = await Promise.allSettled([
    // /admin/users is paginated: { items, total, limit, offset }. Request a high
    // limit so the client-side search in UsersAdmin still sees the full list.
    apiGet<{ items: AdminUser[]; total: number }>("/admin/users?limit=200"),
    // Identify the signed-in admin so we can hide self-deactivation (the backend
    // rejects it too) and decide engineer-grant rights. A failure here just
    // leaves controls visible — the backend still enforces every guard.
    getAuthContext(),
    // The live role-capabilities config for the expandable table (#163). Best
    // effort: if it can't load, the table is simply omitted — it's supplementary
    // to the user list, not load-bearing.
    apiGet<PermissionMatrix>("/admin/role-capabilities"),
  ]);

  if (usersResult.status === "fulfilled") {
    users = usersResult.value.items;
  } else {
    const e = usersResult.reason;
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load users.");
  }
  if (ctxResult.status === "fulfilled") {
    currentUserId = ctxResult.value.user_id;
    canAssignEngineer = ctxResult.value.roles?.includes(ROLE.ENGINEER) ?? false;
  }
  const capabilities: PermissionMatrix | null =
    capabilitiesResult.status === "fulfilled" ? capabilitiesResult.value : null;

  return (
    <>
      <Topbar title="User administration">
        <TopbarSearch />
      </Topbar>
      <main className="flex-1 overflow-auto p-6">
        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "Super Admin access required"
                : "Couldn't load users"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </Card>
        ) : users && users.length === 0 ? (
          <>
            {capabilities && <RoleCapabilitiesTable matrix={capabilities} />}
            <div className="mb-4 flex items-center justify-end">
              <CreateUserDialog />
            </div>
            <Card className="p-10 text-center text-sm text-gray-500">
              No users provisioned yet.
            </Card>
          </>
        ) : (
          <>
            {capabilities && <RoleCapabilitiesTable matrix={capabilities} />}
            <UsersAdmin
              users={users!}
              currentUserId={currentUserId}
              canAssignEngineer={canAssignEngineer}
              initialQ={initialQ}
            />
          </>
        )}
      </main>
    </>
  );
}
