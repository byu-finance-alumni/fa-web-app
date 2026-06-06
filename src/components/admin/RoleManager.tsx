"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { assignRole, removeRole } from "@/app/(app)/admin/actions";

const ROLES = [
  { value: "super_admin", label: "Super admin" },
  { value: "full_access", label: "Full access" },
  { value: "view_only", label: "View only" },
] as const;

const labelOf = (v: string) => ROLES.find((r) => r.value === v)?.label ?? v;

/**
 * Super-admin role editor for an existing user: removable role chips + an
 * add-role dropdown. The whole Admin screen is already super_admin-gated, and
 * the backend re-enforces it. Creating brand-new users (temp password) is a
 * separate flow — see docs/PRE-LAUNCH.md.
 */
export function RoleManager({
  userId,
  roles,
}: {
  userId: number;
  roles: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const available = ROLES.filter((r) => !roles.includes(r.value));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {roles.length ? (
        roles.map((r) => (
          <span
            key={r}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
              r === "super_admin"
                ? "bg-brand-blue-50 text-brand-blue-600"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {labelOf(r)}
            <button
              type="button"
              disabled={pending}
              title={`Remove ${labelOf(r)}`}
              onClick={() =>
                startTransition(async () => {
                  const res = await removeRole(userId, r);
                  setError(res?.error ?? null);
                })
              }
              className="text-gray-400 hover:text-danger-600 disabled:opacity-50"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))
      ) : (
        <span className="text-gray-300">—</span>
      )}

      {available.length ? (
        <select
          disabled={pending}
          value=""
          aria-label="Add role"
          onChange={(e) => {
            const v = e.target.value;
            if (v)
              startTransition(async () => {
                const res = await assignRole(userId, v);
                setError(res?.error ?? null);
              });
          }}
          className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-600"
        >
          <option value="">+ Add</option>
          {available.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      ) : null}

      {error ? <span className="text-xs text-danger-600">{error}</span> : null}
    </div>
  );
}
