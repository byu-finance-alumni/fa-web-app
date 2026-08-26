"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";
import { useUrlQueryParam } from "@/lib/useUrlQueryParam";
import { RoleManager } from "@/components/admin/RoleManager";
import { UserActiveToggle } from "@/components/admin/UserActiveToggle";
import { UnlockResetPassword } from "@/components/admin/UnlockResetPassword";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { UserNameEditor } from "@/components/admin/UserNameEditor";
import { DeleteUser } from "@/components/admin/DeleteUser";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ROLE } from "@/constants/roles";

export interface AdminUser {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  active: boolean;
  roles: string[];
  locked_at: string | null;
  locked: boolean;
  /** ISO timestamp the account was provisioned. */
  created_at: string | null;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Deterministic "Mon D, YYYY" from an ISO string (UTC → no hydration drift). */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

const displayName = (u: AdminUser) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;

function LockedBadge() {
  return (
    <Badge variant="danger" className="shrink-0">
      Locked
    </Badge>
  );
}

/**
 * Client-side Users tab: live search (name/email), a "Created" column, and
 * role management. `canAssignEngineer` (the viewer is an engineer) gates whether
 * the engineer role can be granted/removed in the UI — the backend enforces the
 * same ceiling.
 *
 * The search term is mirrored into the URL (`?q=`) via `useUrlQueryParam` so it
 * survives back-navigation and is shareable, consistent with every other list
 * page (#259). Filtering stays client-side over the already-loaded `users`.
 */
export function UsersAdmin({
  users,
  currentUserId,
  canAssignEngineer,
  actorRoles,
  initialQ = "",
}: {
  users: AdminUser[];
  currentUserId: number | null;
  canAssignEngineer: boolean;
  /** The signed-in admin's roles — drives the Create User role dropdown. */
  actorRoles?: readonly string[];
  /** Search term read from the URL (`?q=`) by the server component. */
  initialQ?: string;
}) {
  const [q, setQ] = useUrlQueryParam("q", initialQ, { basePath: "/admin" });

  // Show the permanent-delete control everywhere the backend would allow it:
  // never on your own row, and (for non-engineers) never on an engineer's row.
  // The backend re-enforces these plus the last-admin guard.
  const canDelete = (u: AdminUser) =>
    u.user_id !== currentUserId &&
    (!u.roles.includes(ROLE.ENGINEER) || canAssignEngineer);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) =>
      [u.first_name, u.last_name, u.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [q, users]);

  return (
    <>
      {/* Top actions: search + create */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users by name or email…"
            aria-label="Search users"
            className="pl-9"
          />
        </div>
        <CreateUserDialog actorRoles={actorRoles} />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-gray-500">
          {q ? `No users match “${q}”.` : "No users match these filters."}
        </Card>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((u) => (
              <Card key={u.user_id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900">
                        {[u.first_name, u.last_name].filter(Boolean).join(" ") ||
                          "—"}
                      </p>
                      <UserNameEditor
                        userId={u.user_id}
                        firstName={u.first_name}
                        lastName={u.last_name}
                      />
                    </div>
                    <p className="truncate text-xs text-gray-500">{u.email}</p>
                    <p className="text-xs text-gray-400">
                      Created {fmtDate(u.created_at)}
                    </p>
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
                  <RoleManager
                    userId={u.user_id}
                    roles={u.roles}
                    canAssignEngineer={canAssignEngineer}
                  />
                  <div className="flex items-center gap-2">
                    <UnlockResetPassword
                      userId={u.user_id}
                      locked={u.locked}
                      active={u.active}
                      name={displayName(u)}
                    />
                    {canDelete(u) ? (
                      <DeleteUser
                        userId={u.user_id}
                        email={u.email}
                        name={displayName(u)}
                      />
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="w-48 px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.user_id}
                    className="border-b border-gray-200 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {[u.first_name, u.last_name]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </span>
                        <UserNameEditor
                          userId={u.user_id}
                          firstName={u.first_name}
                          lastName={u.last_name}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleManager
                        userId={u.user_id}
                        roles={u.roles}
                        canAssignEngineer={canAssignEngineer}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {fmtDate(u.created_at)}
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
                      <div className="flex items-center gap-2">
                        <UnlockResetPassword
                          userId={u.user_id}
                          locked={u.locked}
                          active={u.active}
                          name={displayName(u)}
                        />
                        {canDelete(u) ? (
                          <DeleteUser
                            userId={u.user_id}
                            email={u.email}
                            name={displayName(u)}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
