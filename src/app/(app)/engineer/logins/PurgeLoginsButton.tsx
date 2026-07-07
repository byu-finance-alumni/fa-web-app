"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { purgeLogins } from "./actions";

/**
 * Engineer-only "Delete all logins" control (#200). Wipes the entire login
 * history. Two-click confirm (no dialog dependency): the first click arms it,
 * the second executes — because this is irreversible. Text-only per the app's
 * icon-free control convention.
 */
export function PurgeLoginsButton() {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function run() {
    startTransition(async () => {
      const result = await purgeLogins();
      setArmed(false);
      if (result.ok) {
        toast.success(
          `Deleted ${result.deleted.toLocaleString()} login ${
            result.deleted === 1 ? "record" : "records"
          }.`,
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!armed) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setArmed(true)}
        className="text-danger-600 hover:text-danger-700"
      >
        Delete all logins
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Delete the entire history?</span>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={run}
        disabled={pending}
      >
        {pending ? "Deleting…" : "Yes, delete all"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setArmed(false)}
        disabled={pending}
      >
        Cancel
      </Button>
    </div>
  );
}
