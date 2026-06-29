"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { assignRole, removeRole } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ASSIGNABLE_ROLES, ROLE, roleLabel } from "@/constants/roles";

const labelOf = roleLabel;
// Distinct badge color per role so roles are scannable at a glance in the user
// table. Presentation only — the backend enforces what each role can do.
const ROLE_BADGE: Record<
  string,
  "solid" | "tag" | "success" | "warning" | "neutral"
> = {
  [ROLE.ENGINEER]: "solid",
  [ROLE.SUPER_ADMIN]: "tag",
  [ROLE.FULL_ACCESS]: "success",
  [ROLE.STUDENT]: "warning",
  [ROLE.VIEW_ONLY]: "neutral",
};
const roleBadgeVariant = (role: string) => ROLE_BADGE[role] ?? "neutral";

/**
 * Super-admin role editor for an existing user: removable role chips + an
 * add-role dropdown. The whole Admin screen is already super_admin-gated, and
 * the backend re-enforces it. Creating brand-new users (temp password) is a
 * separate flow — see docs/PRE-LAUNCH.md.
 *
 * `canAssignEngineer` reflects whether the SIGNED-IN admin is an engineer. Only
 * an engineer may grant or remove the engineer role (the backend enforces this
 * ceiling), so for everyone else we hide engineer from the add-dropdown and hide
 * the remove "×" on an engineer chip — no point offering an action the API 403s.
 */
export function RoleManager({
  userId,
  roles,
  canAssignEngineer = false,
}: {
  userId: number;
  roles: string[];
  canAssignEngineer?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const available = ASSIGNABLE_ROLES.filter(
    (r) =>
      !roles.includes(r.value) &&
      (r.value !== ROLE.ENGINEER || canAssignEngineer),
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {roles.length ? (
        roles.map((r) => (
          <Badge key={r} variant={roleBadgeVariant(r)}>
            {labelOf(r)}
            {r === ROLE.ENGINEER && !canAssignEngineer ? null : (
              <button
                type="button"
                disabled={pending}
                title={`Remove ${labelOf(r)}`}
                onClick={() =>
                  startTransition(async () => {
                    const res = await removeRole(userId, r);
                    if (res?.error) toast.error(res.error);
                    else {
                      toast.success(`${labelOf(r)} removed.`);
                      // revalidatePath alone doesn't re-render from a bare
                      // startTransition (PR #138) — refresh so the chip updates.
                      router.refresh();
                    }
                  })
                }
                className="text-current opacity-60 hover:text-danger-600 hover:opacity-100 disabled:opacity-50"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </Badge>
        ))
      ) : (
        <span className="text-gray-300">—</span>
      )}

      {available.length ? (
        <Select
          disabled={pending}
          value=""
          aria-label="Add role"
          onChange={(e) => {
            const v = e.target.value;
            if (v)
              startTransition(async () => {
                const res = await assignRole(userId, v);
                if (res?.error) toast.error(res.error);
                else {
                  toast.success(`${labelOf(v)} added.`);
                  router.refresh();
                }
              });
          }}
          // Explicit light surface + color-scheme so the native option list
          // renders dark-on-white (Bug fix: an unstyled native select painted a
          // black/opaque dropdown on dark-mode machines).
          style={{ colorScheme: "light" }}
          className="h-8 w-auto pl-2 pr-7 text-xs text-gray-500"
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
        </Select>
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
