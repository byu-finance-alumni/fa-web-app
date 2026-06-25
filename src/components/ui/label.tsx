import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Label — form field label. One style for the whole app (UX-UI.md), replacing
 * the divergent `labelCls` copies. Pair with `htmlFor` / wrap the control.
 */
const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentProps<"label">
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("block text-xs font-medium text-gray-700", className)}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
