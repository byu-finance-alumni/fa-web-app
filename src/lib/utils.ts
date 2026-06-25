import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class strings, resolving conflicts (later wins). Used by every
 * design-system primitive in `src/components/ui/` so callers can override styles
 * via `className` without fighting specificity. See `UX-UI.md` for the tokens.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
