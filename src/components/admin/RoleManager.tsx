"use client";

import { useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { assignRole, removeRole } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";
import { ASSIGNABLE_ROLES, ROLE, roleLabel } from "@/constants/roles";

const labelOf = roleLabel;
// The top roles get a highlighted chip so they stand out in the user table.
const TOP_ROLES = new Set<string>([ROLE.ENGINEER, ROLE.SUPER_ADMIN]);

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
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const available = ASSIGNABLE_ROLES.filter((r) => !roles.includes(r.value));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {roles.length ? (
        roles.map((r) => (
          <span
            key={r}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
              TOP_ROLES.has(r)
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
                  if (res?.error) toast.error(res.error);
                  else toast.success(`${labelOf(r)} removed.`);
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
                if (res?.error) toast.error(res.error);
                else toast.success(`${labelOf(v)} added.`);
              });
          }}
          // Explicit light surface + color-scheme so the native option list
          // renders dark-on-white (Bug fix: an unstyled native select painted a
          // black/opaque dropdown on dark-mode machines).
          style={{ colorScheme: "light" }}
          className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-600 disabled:opacity-50"
        >
          <option value="" className="bg-white text-gray-900">
            + Add
          </option>
          {available.map((r) => (
            <option
              key={r.value}
              value={r.value}
              className="bg-white text-gray-900"
            >
              {r.label}
            </option>
          ))}
        </select>
      ) : null}

      {pending ? (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-gray-400"
          aria-label="Saving"
        />
      ) : null}
    </div>
  );
}
