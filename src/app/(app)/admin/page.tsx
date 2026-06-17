import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { UsersAdmin, type AdminUser } from "@/components/admin/UsersAdmin";
import type { UserContext } from "@/types/alumni";
import { ROLE } from "@/constants/roles";

export default async function AdminPage() {
  let users: AdminUser[] | null = null;
  let error: ApiError | null = null;
  let currentUserId: number | null = null;
  // Whether the signed-in admin is an engineer — gates granting/removing the
  // engineer role in the UI (backend enforces the same ceiling).
  let canAssignEngineer = false;
  try {
    users = await apiGet<AdminUser[]>("/admin/users");
    // Identify the signed-in admin so we can hide self-deactivation (the backend
    // rejects it too) and decide engineer-grant rights. A failure here just
    // leaves controls visible — the backend still enforces every guard.
    try {
      const ctx = await apiGet<UserContext>("/auth/context");
      currentUserId = ctx.user_id;
      canAssignEngineer = ctx.roles?.includes(ROLE.ENGINEER) ?? false;
    } catch {
      currentUserId = null;
    }
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load users.");
  }

  return (
    <>
      <Topbar title="User administration">
        <TopbarSearch />
      </Topbar>
      <main className="flex-1 overflow-auto p-6">
        {error ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">
              {error.status === 403
                ? "Super Admin access required"
                : "Couldn't load users"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </div>
        ) : users && users.length === 0 ? (
          <>
            <div className="mb-4 flex items-center justify-end">
              <CreateUserDialog />
            </div>
            <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              No users provisioned yet.
            </div>
          </>
        ) : (
          <UsersAdmin
            users={users!}
            currentUserId={currentUserId}
            canAssignEngineer={canAssignEngineer}
          />
        )}
      </main>
    </>
  );
}
