import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input — text/number/search/date field. One control height (h-9),
 * `rounded-md`, one focus ring (UX-UI.md). Replaces the many duplicated
 * `fieldCls` copies across forms.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 placeholder:text-gray-400",
        "focus-visible:border-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
