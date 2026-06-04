import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";

interface AdminUser {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  active: boolean;
  roles: string[];
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  full_access: "Full access",
  view_only: "View only",
};

function RoleChip({ role }: { role: string }) {
  const isAdmin = role === "super_admin";
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
        isAdmin
          ? "bg-brand-blue-50 text-brand-blue-600"
          : "bg-gray-100 text-gray-700"
      }`}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

export default async function AdminPage() {
  let users: AdminUser[] | null = null;
  let error: ApiError | null = null;
  try {
    users = await apiGet<AdminUser[]>("/admin/users");
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load users.");
  }

  return (
    <>
      <Topbar title="User administration" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500">
            Roles &amp; access · super_admin only
          </p>
        </div>

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
          <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="w-32 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {users!.map((u) => (
                  <tr
                    key={u.user_id}
                    className="border-b border-gray-300 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") ||
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {u.roles.length ? (
                          u.roles.map((r) => <RoleChip key={r} role={r} />)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          u.active
                            ? "bg-gray-100 text-gray-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {u.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
