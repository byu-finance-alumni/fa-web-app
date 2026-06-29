import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Progress — a slim horizontal progress bar. Used for profile completeness,
 * survey-campaign progress, and data-quality coverage. `value` is 0–100.
 */
function Progress({
  value,
  className,
  barClassName,
  ...props
}: {
  value: number;
  barClassName?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-gray-100", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full bg-brand-blue-600 transition-all", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
