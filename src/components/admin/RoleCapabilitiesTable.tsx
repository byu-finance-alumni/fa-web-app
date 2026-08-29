"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PermissionMatrix } from "@/types/permissions";

/**
 * Role-capabilities table for the Users section (#163). A small header line with
 * a click-to-expand control; expanded, it shows what each role (every role
 * EXCEPT engineer) can and cannot do. Driven live from the actual permission
 * config (GET /admin/role-capabilities), so it always reflects changes the
 * engineer makes in the permission editor — never hand-maintained text.
 *
 * Read-only here: only the engineer can change capabilities (in the Engineer
 * Console). The engineer role and the engineer-only console capability are
 * omitted — this table is about the roles a user admin actually assigns.
 */
export function RoleCapabilitiesTable({ matrix }: { matrix: PermissionMatrix }) {
  const [open, setOpen] = useState(false);

  // Every role except engineer; every capability that can be held by those roles.
  const roles = matrix.roles.filter((r) => r.role !== "engineer");
  const caps = matrix.capabilities.filter((c) => c.assignable);

  return (
    <Card className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left"
      >
        <span className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">
            What each role can do
          </span>
          : the capabilities assigned to every role except engineer.
        </span>
        <span className="shrink-0 text-xs font-semibold text-brand-blue-600">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="w-[34%] px-4 py-2.5 text-left align-bottom font-semibold text-gray-900">
                  Capability
                </th>
                {roles.map((role) => (
                  <th
                    key={role.role}
                    className="px-3 py-2.5 text-center align-bottom font-semibold text-gray-700"
                  >
                    {role.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {caps.map((cap) => (
                <tr
                  key={cap.code}
                  className="border-b border-gray-100 align-top last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{cap.label}</p>
                    <p className="mt-0.5 text-xs leading-snug text-gray-500">
                      {cap.description}
                    </p>
                  </td>
                  {roles.map((role) => {
                    const granted = role.capabilities.includes(cap.code);
                    return (
                      <td
                        key={`${role.role}:${cap.code}`}
                        className="px-3 py-3 text-center"
                      >
                        <Badge variant={granted ? "success" : "muted"}>
                          {granted ? "Yes" : "No"}
                        </Badge>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
