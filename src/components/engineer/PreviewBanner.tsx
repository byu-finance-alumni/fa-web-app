"use client";

import { useTransition } from "react";
import { exitPreview } from "@/app/(app)/engineer/preview/actions";

/**
 * Persistent preview-as-role banner (#165). Shown across the whole app shell
 * whenever the engineer is previewing as another role, so it's always obvious
 * they're not seeing their own account — with a one-click exit. Uses the warning
 * surface so it reads as a temporary, attention-getting state.
 */
export function PreviewBanner({ roleLabel }: { roleLabel: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-center gap-3 bg-warning-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm">
      <span className="tracking-wide">
        PREVIEW MODE: viewing as{" "}
        <span className="font-bold uppercase">{roleLabel}</span>. You are still
        signed in as yourself.
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => exitPreview())}
        disabled={pending}
        className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-warning-600 transition-colors hover:bg-warning-50 disabled:opacity-50"
      >
        {pending ? "Exiting…" : "Exit preview"}
      </button>
    </div>
  );
}
