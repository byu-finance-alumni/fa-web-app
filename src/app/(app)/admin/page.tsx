import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { RoleManager } from "@/components/admin/RoleManager";
import { UserActiveToggle } from "@/components/admin/UserActiveToggle";
import { UnlockResetPassword } from "@/components/admin/UnlockResetPassword";
import type { UserContext } from "@/types/alumni";

interface AdminUser {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  active: boolean;
  roles: string[];
  /** ISO timestamp the account was locked out (login lockout), else null. */
  locked_at: string | null;
  /** Whether the account is currently locked out of login. */
  locked: boolean;
}

function LockedBadge() {
  return (
    <span className="shrink-0 rounded-md bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-600">
      Locked
    </span>
  );
}

const displayName = (u: AdminUser) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;

export default async function AdminPage() {
  let users: AdminUser[] | null = null;
  let error: ApiError | null = null;
  let currentUserId: number | null = null;
  try {
    users = await apiGet<AdminUser[]>("/admin/users");
    // Identify the signed-in super_admin so we can hide self-deactivation
    // (the backend rejects it too). A failure here just leaves the control
    // visible on every row — the backend still enforces the guard.
    try {
      currentUserId = (await apiGet<UserContext>("/auth/context")).user_id;
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
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No users provisioned yet.
          </div>
        ) : (
          <>
          {/* Mobile: stacked cards */}
          <div className="space-y-2 md:hidden">
            {users!.map((u) => (
              <div
                key={u.user_id}
                className="rounded-xl border border-gray-300 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <InitialsAvatar
                    name={
                      [u.first_name, u.last_name].filter(Boolean).join(" ") ||
                      u.email
                    }
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") ||
                        "—"}
                    </p>
                    <p className="truncate text-xs text-gray-500">{u.email}</p>
                  </div>
                  {u.locked ? <LockedBadge /> : null}
                  <UserActiveToggle
                    userId={u.user_id}
                    active={u.active}
                    isSelf={u.user_id === currentUserId}
                    name={displayName(u)}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <RoleManager userId={u.user_id} roles={u.roles} />
                  <UnlockResetPassword
                    userId={u.user_id}
                    locked={u.locked}
                    name={displayName(u)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-300 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="w-48 px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users!.map((u) => (
                  <tr
                    key={u.user_id}
                    className="border-b border-gray-300 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar
                          name={
                            [u.first_name, u.last_name]
                              .filter(Boolean)
                              .join(" ") || u.email
                          }
                          size="sm"
                        />
                        <span className="font-medium text-gray-900">
                          {[u.first_name, u.last_name]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleManager userId={u.user_id} roles={u.roles} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserActiveToggle
                          userId={u.user_id}
                          active={u.active}
                          isSelf={u.user_id === currentUserId}
                          name={displayName(u)}
                        />
                        {u.locked ? <LockedBadge /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <UnlockResetPassword
                        userId={u.user_id}
                        locked={u.locked}
                        name={displayName(u)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </main>
    </>
  );
}
