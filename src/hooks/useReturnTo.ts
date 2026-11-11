"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { returnToFor, withReturnTo } from "@/lib/returnTo";

/**
 * The `from` a profile link clicked on THIS page should carry (#937): the page's
 * own URL with its filters, or a profile's own `from` when on a profile. Null
 * when there is nothing safe to carry (a form, an unknown screen).
 */
export function useReturnTo(): string | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return returnToFor(pathname ?? "", searchParams);
}

/** `(href) => href + ?from=<this page>` — for links and `router.push` into a profile. */
export function useProfileHref(): (href: string) => string {
  const from = useReturnTo();
  return useCallback((href: string) => withReturnTo(href, from), [from]);
}
