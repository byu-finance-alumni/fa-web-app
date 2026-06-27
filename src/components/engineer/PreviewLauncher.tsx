"use client";

import { useTransition } from "react";
import { enterPreview, exitPreview } from "@/app/(app)/engineer/preview/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/Toast";
import type { PermissionMatrix } from "@/types/permissions";

/**
 * Preview-as-role launcher (#165). Lists every previewable role (everything
 * below engineer) with a summary of what it can do, and a button to enter
 * preview as that role. Entering sets a cookie the app shell reads to render
 * navigation as that role, plus a persistent exit banner. Read-only — the
 * engineer's real session is unchanged; the previewed roles are strictly less
 * privileged.
 */
export function PreviewLauncher({
  matrix,
  current,
}: {
  matrix: PermissionMatrix;
  current: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const roles = matrix.roles.filter((r) => r.role !== "engineer");
  const caps = matrix.capabilities.filter((c) => c.assignable);

  function onEnter(role: string) {
    startTransition(async () => {
      const result = await enterPreview(role);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {roles.map((role) => {
        const isCurrent = current === role.role;
        return (
          <Card key={role.role} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {role.label}
                  </h2>
                  {isCurrent && <Badge variant="warning">Previewing</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {caps.map((cap) => {
                    const granted = role.capabilities.includes(cap.code);
                    return (
                      <Badge
                        key={cap.code}
                        variant={granted ? "success" : "muted"}
                      >
                        {granted ? cap.label : `No ${cap.label.toLowerCase()}`}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              {isCurrent ? (
                <button
                  type="button"
                  onClick={() => startTransition(() => exitPreview())}
                  disabled={pending}
                  className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  Exit preview
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onEnter(role.role)}
                  disabled={pending}
                  className="shrink-0 rounded-md bg-brand-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-blue-500 disabled:opacity-50"
                >
                  Preview as {role.label}
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
