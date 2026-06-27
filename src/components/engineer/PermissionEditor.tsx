"use client";

import { useState, useTransition } from "react";
import { togglePermission } from "@/app/(app)/engineer/permissions/actions";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/Toast";
import type { PermissionMatrix } from "@/types/permissions";

/**
 * Permission editor matrix (#164). Rows = capabilities, columns = roles. Each
 * editable cell is an On/Off toggle that grants or revokes that capability for
 * that role via the backend (which re-enforces engineer-only access, audits the
 * change, and returns the authoritative matrix). The engineer column and the
 * non-assignable "Engineer console" capability are shown locked — the engineer
 * always holds everything and that capability can never be handed to another
 * role, so there's nothing to toggle.
 *
 * The frontend NEVER enforces anything here — these toggles only write config;
 * the backend gates every request against it.
 */
export function PermissionEditor({ initial }: { initial: PermissionMatrix }) {
  const [matrix, setMatrix] = useState(initial);
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  const held = (roleCode: string, capCode: string) =>
    matrix.roles
      .find((r) => r.role === roleCode)
      ?.capabilities.includes(capCode) ?? false;

  function onToggle(roleCode: string, capCode: string, next: boolean) {
    const cell = `${roleCode}:${capCode}`;
    setPendingCell(cell);
    startTransition(async () => {
      const result = await togglePermission(roleCode, capCode, next);
      if (result.ok) {
        setMatrix(result.matrix);
      } else {
        toast.error(result.error);
      }
      setPendingCell(null);
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="w-[34%] px-3 py-2.5 text-left align-bottom font-semibold text-gray-900">
              Capability
            </th>
            {matrix.roles.map((role) => (
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
          {matrix.capabilities.map((cap) => (
            <tr
              key={cap.code}
              className="border-b border-gray-100 align-top last:border-0"
            >
              <td className="px-3 py-3">
                <p className="font-medium text-gray-900">{cap.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-gray-500">
                  {cap.description}
                </p>
              </td>
              {matrix.roles.map((role) => {
                const granted = held(role.role, cap.code);
                // Locked when the role's grants are fixed (engineer) or the
                // capability can't be assigned to another role (engineer console).
                const locked = !role.editable || !cap.assignable;
                const cell = `${role.role}:${cap.code}`;
                const busy = pendingCell === cell;
                return (
                  <td key={cell} className="px-3 py-3 text-center">
                    {locked ? (
                      <Badge variant={granted ? "tag" : "muted"}>
                        {granted ? "On" : "—"}
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggle(role.role, cap.code, !granted)}
                        disabled={busy || pendingCell !== null}
                        aria-pressed={granted}
                        className={`inline-flex min-w-[3.25rem] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          granted
                            ? "bg-brand-blue-600 text-white hover:bg-brand-blue-500"
                            : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {busy ? "…" : granted ? "On" : "Off"}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
