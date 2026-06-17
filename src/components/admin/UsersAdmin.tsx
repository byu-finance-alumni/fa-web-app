"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { RoleManager } from "@/components/admin/RoleManager";
import { UserActiveToggle } from "@/components/admin/UserActiveToggle";
import { UnlockResetPassword } from "@/components/admin/UnlockResetPassword";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { UserNameEditor } from "@/components/admin/UserNameEditor";
import { DeleteUser } from "@/components/admin/DeleteUser";
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
    <span className="shrink-0 rounded-md bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-600">
      Locked
    </span>
  );
}

/**
 * Client-side Users tab: live search (name/email), a "Created" column, and
 * role management. `canAssignEngineer` (the viewer is an engineer) gates whether
 * the engineer role can be granted/removed in the UI — the backend enforces the
 * same ceiling.
 */
export function UsersAdmin({
  users,
  currentUserId,
  canAssignEngineer,
}: {
  users: AdminUser[];
  currentUserId: number | null;
  canAssignEngineer: boolean;
}) {
  const [q, setQ] = useState("");

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
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users by name or email…"
            aria-label="Search users"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-brand-blue-600 focus:outline-none focus:ring-1 focus:ring-brand-blue-600"
          />
        </div>
        <CreateUserDialog />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No users match “{q}”.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((u) => (
              <div
                key={u.user_id}
                className="rounded-xl border border-gray-300 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={displayName(u)} size="sm" />
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
                    <p className="text-[11px] text-gray-400">
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
                  <th className="px-4 py-3">Created</th>
                  <th className="w-48 px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.user_id}
                    className="border-b border-gray-300 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={displayName(u)} size="sm" />
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
          </div>
        </>
      )}
    </>
  );
}
